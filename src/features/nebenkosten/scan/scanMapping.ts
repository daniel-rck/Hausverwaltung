export type ScannedPosition = {
  label: string;
  amount: number;
  consumption?: number;
  unit?: string;
};

export type ScannedUnit = {
  unitLabel: string;
  tenantName: string;
  positions: ScannedPosition[];
  total: number;
};

export type ScannedAbrechnung = {
  provider: string;
  billingFrom: string;
  billingTo: string;
  year: number;
  units: ScannedUnit[];
  totals: ScannedPosition[];
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function parsePosition(raw: unknown): ScannedPosition | null {
  const obj = asRecord(raw);
  const label = asString(obj.label);
  if (label === "") return null;
  const position: ScannedPosition = { label, amount: asNumber(obj.amount) };
  const consumption = asNumber(obj.consumption);
  if (consumption > 0) position.consumption = consumption;
  const unit = asString(obj.unit);
  if (unit !== "") position.unit = unit;
  return position;
}

function parsePositions(raw: unknown): ScannedPosition[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parsePosition).filter((p): p is ScannedPosition => p !== null);
}

/**
 * Defensive validation of the Gemini JSON. The responseSchema makes the shape
 * likely but not guaranteed — every field is re-checked, missing values become
 * empty strings / 0 so the review UI can let the user correct them.
 */
export function parseScanResponse(raw: unknown): ScannedAbrechnung {
  const obj = asRecord(raw);

  const units: ScannedUnit[] = (Array.isArray(obj.units) ? obj.units : [])
    .map((rawUnit) => {
      const u = asRecord(rawUnit);
      return {
        unitLabel: asString(u.unitLabel),
        tenantName: asString(u.tenantName),
        positions: parsePositions(u.positions),
        total: asNumber(u.total),
      };
    })
    .filter((u) => u.positions.length > 0 || u.total > 0);

  const billingTo = asString(obj.billingTo);
  const yearFromBillingTo = Number.parseInt(billingTo.slice(0, 4), 10);
  const year = asNumber(obj.year) || (Number.isFinite(yearFromBillingTo) ? yearFromBillingTo : 0);

  return {
    provider: asString(obj.provider),
    billingFrom: asString(obj.billingFrom),
    billingTo,
    year,
    units,
    totals: parsePositions(obj.totals),
  };
}

export type OccupancyCandidate = {
  occupancyId: number;
  tenantName: string;
  unitName: string;
};

/**
 * Prefill the unit→occupancy mapping: case-insensitive substring match on
 * tenant name (either direction), falling back to the unit name. The user
 * can always correct the selection in the review UI.
 */
export function matchOccupancy(
  scannedUnit: Pick<ScannedUnit, "unitLabel" | "tenantName">,
  candidates: OccupancyCandidate[],
): OccupancyCandidate | null {
  const tenant = scannedUnit.tenantName.toLowerCase();
  const label = scannedUnit.unitLabel.toLowerCase();

  for (const candidate of candidates) {
    const name = candidate.tenantName.toLowerCase();
    if (name !== "" && tenant !== "" && (tenant.includes(name) || name.includes(tenant))) {
      return candidate;
    }
  }
  for (const candidate of candidates) {
    const unitName = candidate.unitName.toLowerCase();
    if (unitName !== "" && label !== "" && label.includes(unitName)) {
      return candidate;
    }
  }
  return null;
}

const POSITION_KEYWORDS = ["warmwasser", "kaltwasser", "heizung"] as const;
type PositionKeyword = (typeof POSITION_KEYWORDS)[number];

function keywordForLabel(label: string): PositionKeyword | null {
  const l = label.toLowerCase();
  if (l.includes("warmwasser")) return "warmwasser";
  // "Kalt- und Abwasser", "Gerätemiete Kaltwasser", "Abrechnung Kaltwasser"
  if (l.includes("kaltwasser") || l.includes("abwasser")) return "kaltwasser";
  if (l.includes("heizung")) return "heizung";
  return null;
}

/**
 * Prefill the position→costType mapping by keyword match on the cost type
 * name. Among matches, a name mentioning ONLY the position's keyword wins over
 * a combined one (e.g. "Warmwasser (Messdienst)" beats "Heizung/Warmwasser"
 * for a Warmwasser position). Unmatched labels stay unmapped for manual review.
 */
export function prefillPositionMapping(
  labels: string[],
  costTypes: { id?: number; name: string }[],
): Map<string, number> {
  const mapping = new Map<string, number>();

  for (const label of labels) {
    const keyword = keywordForLabel(label);
    if (keyword === null) continue;

    const matches = costTypes.filter(
      (ct) => ct.id != null && ct.name.toLowerCase().includes(keyword),
    );
    const specific = matches.filter((ct) => {
      const name = ct.name.toLowerCase();
      return POSITION_KEYWORDS.every((other) => other === keyword || !name.includes(other));
    });
    const match = specific[0] ?? matches[0];
    if (match?.id != null) mapping.set(label, match.id);
  }

  return mapping;
}

export type CostDraft = {
  costTypeId: number;
  /** Total from the document's "Summe aller Nutzer", fallback: sum of shares. */
  totalAmount: number;
  shares: { occupancyId: number; amount: number }[];
};

/**
 * Aggregate the reviewed mapping into per-cost-type drafts:
 * positions mapped to the same cost type are summed per occupancy.
 * Units without an occupancy mapping and ignored positions are skipped.
 */
export function buildCostDrafts(args: {
  abrechnung: ScannedAbrechnung;
  /** position label → costTypeId, or "ignore". */
  positionMapping: Map<string, number | "ignore">;
  /** index into abrechnung.units → occupancyId. */
  unitMapping: Map<number, number>;
}): CostDraft[] {
  const drafts = new Map<number, CostDraft>();

  const draftFor = (costTypeId: number): CostDraft => {
    let draft = drafts.get(costTypeId);
    if (!draft) {
      draft = { costTypeId, totalAmount: 0, shares: [] };
      drafts.set(costTypeId, draft);
    }
    return draft;
  };

  args.abrechnung.units.forEach((unit, index) => {
    const occupancyId = args.unitMapping.get(index);
    if (occupancyId == null) return;

    const perCostType = new Map<number, number>();
    for (const position of unit.positions) {
      const target = args.positionMapping.get(position.label);
      if (target == null || target === "ignore") continue;
      perCostType.set(target, (perCostType.get(target) ?? 0) + position.amount);
    }

    for (const [costTypeId, amount] of perCostType) {
      const draft = draftFor(costTypeId);
      const existing = draft.shares.find((s) => s.occupancyId === occupancyId);
      if (existing) {
        existing.amount += amount;
      } else {
        draft.shares.push({ occupancyId, amount });
      }
    }
  });

  // Totals from the document's "Summe aller Nutzer" row; fallback share sum.
  for (const draft of drafts.values()) {
    let documentTotal = 0;
    for (const position of args.abrechnung.totals) {
      if (args.positionMapping.get(position.label) === draft.costTypeId) {
        documentTotal += position.amount;
      }
    }
    draft.totalAmount =
      documentTotal > 0 ? documentTotal : draft.shares.reduce((sum, s) => sum + s.amount, 0);
  }

  return [...drafts.values()].filter((d) => d.shares.length > 0);
}
