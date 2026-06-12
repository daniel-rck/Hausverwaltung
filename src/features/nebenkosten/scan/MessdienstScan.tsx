import { useState } from "react";
import { Link } from "react-router-dom";
import { db, useLiveQuery } from "../../../lib/db";
import type { Cost, CostShare } from "../../../lib/db/schema";
import {
  downscale,
  ExtractionError,
  extractAbrechnung,
  getApiKey,
  getModel,
} from "../../../lib/gemini";
import { Card } from "../../../lib/ui/shared/Card";
import { Button, Checkbox, FormField, Select, useToast } from "../../../lib/ui/ui";
import { formatEuro } from "../../../lib/utils/format";
import { buildYearOptions } from "../../../lib/utils/years";
import {
  buildCostDrafts,
  matchOccupancy,
  type OccupancyCandidate,
  parseScanResponse,
  type ScannedAbrechnung,
} from "./scanMapping";

interface MessdienstScanProps {
  propertyId: number;
  year: number;
}

const IGNORE = "ignore" as const;

/** Active occupancies of a property in a given year (mirrors MessdienstInput). */
async function loadCandidates(propertyId: number, year: number): Promise<OccupancyCandidate[]> {
  const units = await db.units.where("propertyId").equals(propertyId).toArray();
  const yearStart = `${year}-01`;
  const yearEnd = `${year}-12`;
  const result: OccupancyCandidate[] = [];
  for (const unit of units) {
    const occs = await db.occupancies.where("unitId").equals(unit.id!).toArray();
    const active = occs.filter((o) => o.from <= yearEnd && (o.to === null || o.to >= yearStart));
    for (const occ of active) {
      const tenant = (await db.tenants.get(occ.tenantId)) ?? null;
      result.push({ occupancyId: occ.id!, tenantName: tenant?.name ?? "", unitName: unit.name });
    }
  }
  return result;
}

/**
 * Photo → Gemini Flash → review table → Cost/CostShare records.
 * Opt-in per scan: the photo leaves the device only for extraction,
 * sent directly to Google's API with the user's own key.
 */
export function MessdienstScan({ propertyId, year }: MessdienstScanProps) {
  const toast = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [scan, setScan] = useState<ScannedAbrechnung | null>(null);
  const [reviewYear, setReviewYear] = useState(year);
  const [positionMapping, setPositionMapping] = useState<Map<string, number | typeof IGNORE>>(
    new Map(),
  );
  const [unitMapping, setUnitMapping] = useState<Map<number, number>>(new Map());

  const hasApiKey = getApiKey() !== "";

  const costTypes = useLiveQuery(() =>
    db.costTypes
      .orderBy("sortOrder")
      .toArray()
      .then((all) =>
        all.filter((ct) => ct.distribution === "messdienst" || ct.distribution === "direct"),
      ),
  );

  // Occupancies of the *scanned* year, not the page year.
  const candidates = useLiveQuery(
    () => loadCandidates(propertyId, reviewYear),
    [propertyId, reviewYear],
  );

  const positionLabels = scan
    ? [...new Set([...scan.units.flatMap((u) => u.positions), ...scan.totals].map((p) => p.label))]
    : [];

  const handleScan = async () => {
    if (files.length === 0 || !consent) return;
    setScanning(true);
    try {
      const images = await Promise.all(files.map((f) => downscale(f)));
      const raw = await extractAbrechnung(images, { apiKey: getApiKey(), model: getModel() });
      const parsed = parseScanResponse(raw);
      if (parsed.units.length === 0) {
        toast.error("Keine Nutzerabrechnungen im Foto erkannt — bitte manuell erfassen.");
        return;
      }
      const scanYear = parsed.year > 0 ? parsed.year : year;
      setScan(parsed);
      setReviewYear(scanYear);
      // Prefill the unit mapping via tenant-name match against the scanned year.
      const yearCandidates = await loadCandidates(propertyId, scanYear);
      const prefill = new Map<number, number>();
      parsed.units.forEach((unit, index) => {
        const match = matchOccupancy(unit, yearCandidates);
        if (match) prefill.set(index, match.occupancyId);
      });
      setUnitMapping(prefill);
      setPositionMapping(new Map());
    } catch (err) {
      toast.error(err instanceof ExtractionError ? err.message : "Scan fehlgeschlagen.");
    } finally {
      setScanning(false);
    }
  };

  const drafts = scan ? buildCostDrafts({ abrechnung: scan, positionMapping, unitMapping }) : [];

  const handleApply = async () => {
    if (!scan || drafts.length === 0) return;
    setApplying(true);
    try {
      const allCosts = await db.costs.where("propertyId").equals(propertyId).toArray();
      const allShares = await db.costShares.toArray();

      for (const draft of drafts) {
        const existingCost = allCosts.find(
          (c) => c.year === reviewYear && c.costTypeId === draft.costTypeId,
        );
        let costId: number;
        if (existingCost?.id) {
          costId = existingCost.id;
          await db.costs.update(costId, { totalAmount: draft.totalAmount });
        } else {
          const cost: Omit<Cost, "id"> = {
            propertyId,
            year: reviewYear,
            costTypeId: draft.costTypeId,
            totalAmount: draft.totalAmount,
          };
          costId = (await db.costs.add(cost as Cost)) as number;
        }

        for (const share of draft.shares) {
          const existingShare = allShares.find(
            (s) => s.costId === costId && s.occupancyId === share.occupancyId,
          );
          if (existingShare?.id) {
            await db.costShares.update(existingShare.id, { amount: share.amount });
          } else {
            const record: Omit<CostShare, "id"> = {
              costId,
              occupancyId: share.occupancyId,
              amount: share.amount,
            };
            await db.costShares.add(record as CostShare);
          }
        }
      }

      toast.success(
        `${drafts.length} ${drafts.length === 1 ? "Kostenart" : "Kostenarten"} übernommen (${reviewYear}).`,
      );
      setScan(null);
      setFiles([]);
      setConsent(false);
    } catch (err) {
      toast.error("Übernehmen fehlgeschlagen.");
      console.error(err);
    } finally {
      setApplying(false);
    }
  };

  if (!hasApiKey) {
    return (
      <Card title="Abrechnung scannen (KI)">
        <p className="text-sm text-fg-muted">
          Fotografierte Messdienst-Abrechnungen (z.B. Brunata, Techem) können automatisch ausgelesen
          werden. Dafür wird ein eigener Gemini-API-Key benötigt — hinterlege ihn in den{" "}
          <Link to="/einstellungen" className="underline text-fg">
            Einstellungen
          </Link>
          .
        </p>
      </Card>
    );
  }

  return (
    <Card title="Abrechnung scannen (KI)">
      {!scan ? (
        <div className="space-y-3">
          <p className="text-sm text-fg-muted">
            Foto(s) der Nutzerabrechnung („Übersicht aller Nutzerabrechnungen") aufnehmen oder
            auswählen — die Pro-Wohnung-Beträge werden automatisch extrahiert und unten zur
            Kontrolle angezeigt.
          </p>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="block text-sm text-fg-muted file:mr-3 file:px-3 file:py-1.5 file:text-sm file:border file:border-border file:rounded-lg file:bg-surface file:text-fg"
          />
          <Checkbox
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            label="Die Fotos werden zur Auswertung an Google Gemini übertragen (eigener API-Key). Sie können Mieternamen enthalten."
          />
          <Button
            variant="primary"
            accent="nebenkosten"
            disabled={files.length === 0 || !consent || scanning}
            onClick={() => void handleScan()}
          >
            {scanning ? "Wird ausgelesen…" : "Auslesen"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <FormField label="Erkanntes Abrechnungsjahr">
              <Select
                value={reviewYear}
                onChange={(e) => setReviewYear(Number(e.target.value))}
                className="!h-9 max-w-[120px]"
              >
                {buildYearOptions({
                  currentYear: Math.max(new Date().getFullYear(), reviewYear),
                }).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </FormField>
            <p className="text-xs text-fg-muted pb-2">
              {scan.provider && <>Messdienst: {scan.provider} · </>}
              Zeitraum: {scan.billingFrom || "?"} – {scan.billingTo || "?"}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-fg mb-2">Positionen → Kostenarten</h3>
            <div className="space-y-2">
              {positionLabels.map((label) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-sm text-fg flex-1">{label}</span>
                  <Select
                    value={positionMapping.get(label) ?? IGNORE}
                    onChange={(e) => {
                      const value = e.target.value === IGNORE ? IGNORE : Number(e.target.value);
                      setPositionMapping((prev) => new Map(prev).set(label, value));
                    }}
                    className="!h-8 max-w-[240px]"
                  >
                    <option value={IGNORE}>Ignorieren</option>
                    {(costTypes ?? []).map((ct) => (
                      <option key={ct.id} value={ct.id}>
                        {ct.name}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-fg mb-2">Wohnungen → Belegungen</h3>
            <div className="space-y-2">
              {scan.units.map((unit, index) => (
                <div
                  key={`${unit.unitLabel}-${unit.tenantName}`}
                  className="flex items-center gap-3"
                >
                  <span className="text-sm text-fg flex-1">
                    {unit.unitLabel} – {unit.tenantName}{" "}
                    <span className="text-fg-muted">({formatEuro(unit.total)})</span>
                  </span>
                  <Select
                    value={unitMapping.get(index) ?? ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setUnitMapping((prev) => {
                        const next = new Map(prev);
                        if (value === "") next.delete(index);
                        else next.set(index, Number(value));
                        return next;
                      });
                    }}
                    className="!h-8 max-w-[240px]"
                  >
                    <option value="">– Nicht übernehmen –</option>
                    {(candidates ?? []).map((c) => (
                      <option key={c.occupancyId} value={c.occupancyId}>
                        {c.unitName} – {c.tenantName || "Unbekannt"}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
          </div>

          {drafts.length > 0 && (
            <p className="text-xs text-fg-muted">
              {drafts.length} {drafts.length === 1 ? "Kostenart wird" : "Kostenarten werden"} mit
              insgesamt {formatEuro(drafts.reduce((sum, d) => sum + d.totalAmount, 0))} übernommen.
            </p>
          )}

          <div className="flex gap-2">
            <Button
              variant="primary"
              accent="nebenkosten"
              disabled={drafts.length === 0 || applying}
              onClick={() => void handleApply()}
            >
              {applying ? "Übernehme…" : "Übernehmen"}
            </Button>
            <Button variant="secondary" onClick={() => setScan(null)}>
              Verwerfen
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
