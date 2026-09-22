import { useState } from "react";
import { db, useLiveQuery } from "../../lib/db";
import type { HeatingStatement, StatementPosition } from "../../lib/db/schema";
import { Card } from "../../lib/ui/shared/Card";
import { NumInput } from "../../lib/ui/shared/NumInput";
import {
  Button,
  FormField,
  IconButton,
  Input,
  Skeleton,
  useConfirm,
  useToast,
} from "../../lib/ui/ui";
import { AlertTriangle, CheckCircle2, Plus, Trash2 } from "../../lib/ui/ui/icons";
import { formatEuro } from "../../lib/utils/format";
import { computedConsumptionLiters, plausibility } from "./gesamtrechnung";

/**
 * Texteingabe mit Fokus-Puffer (Muster: NumInput): während der Eingabe lokaler
 * State, Commit erst bei Blur — direkte DB-Writes pro Tastendruck würden über
 * useLiveQuery-Rerenders Zeichen verschlucken.
 */
function TextCell({
  value,
  onCommit,
  placeholder,
  type = "text",
  id,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: {
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  type?: "text" | "date";
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  return (
    <Input
      id={id}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      type={type}
      placeholder={placeholder}
      value={editing ? draft : value}
      onFocus={() => {
        setEditing(true);
        setDraft(value);
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft !== value) onCommit(draft);
      }}
    />
  );
}

interface GesamtrechnungCardProps {
  propertyId: number;
  year: number;
}

function emptyStatement(propertyId: number, year: number): HeatingStatement {
  return {
    propertyId,
    year,
    provider: "",
    fuelType: "Heizöl",
    openingStock: { liters: 0, amount: 0 },
    purchases: [],
    closingStock: { liters: 0, amount: 0 },
    consumption: { liters: 0, amount: 0 },
    co2LandlordShare: 0,
    otherHeatingCosts: [],
    separateCosts: [],
    totalDistributed: 0,
  };
}

/**
 * Erfassung der Messdienst-Gesamtrechnung (Gebäudeebene): Brennstoff-Bestand,
 * weitere Heizungsbetriebskosten, gesondert verteilte Kosten. Dokumentation +
 * Plausibilität — verteilt wird über die Messdienst-Anteile, nicht hier.
 */
export function GesamtrechnungCard({ propertyId, year }: GesamtrechnungCardProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const statement = useLiveQuery(
    () =>
      db.heatingStatements
        .where("propertyId")
        .equals(propertyId)
        .toArray()
        .then((all) => {
          // Der Index [propertyId+year] ist bewusst nicht unique (Sync kann
          // Duplikate erzeugen) — deterministisch den zuletzt geänderten nehmen.
          const matches = all.filter((s) => s.year === year);
          matches.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
          return matches[0] ?? null;
        }),
    [propertyId, year],
  );

  // Summe der erfassten Messdienst-Kosten des Jahres für den Quercheck.
  const messdienstCostsTotal = useLiveQuery(async () => {
    const [costTypes, costs] = await Promise.all([
      db.costTypes.toArray(),
      db.costs.where("propertyId").equals(propertyId).toArray(),
    ]);
    const messdienstIds = new Set(
      costTypes.flatMap((ct) => (ct.distribution === "messdienst" && ct.id != null ? [ct.id] : [])),
    );
    const relevant = costs.filter(
      (c) => c.year === year && messdienstIds.has(c.costTypeId) && c.totalAmount > 0,
    );
    if (relevant.length === 0) return null;
    return relevant.reduce((sum, c) => sum + c.totalAmount, 0);
  }, [propertyId, year]);

  const cardTitle = `Gesamtrechnung (Gebäude) ${year} – Brennstoff & Heizungsbetriebskosten`;

  if (statement === undefined) {
    return (
      <Card title={cardTitle}>
        <Skeleton height="20rem" />
      </Card>
    );
  }

  const s = statement ?? emptyStatement(propertyId, year);

  const update = async (patch: Partial<HeatingStatement>) => {
    try {
      if (statement?.id) {
        await db.heatingStatements.update(statement.id, patch);
      } else {
        await db.heatingStatements.add({ ...emptyStatement(propertyId, year), ...patch });
      }
    } catch (err) {
      toast.error("Speichern fehlgeschlagen.");
      console.error(err);
    }
  };

  /** Fragt nach, bevor eine Zeile mit eingetragenen Werten verworfen wird. */
  const confirmRemove = (hasData: boolean, what: string) =>
    hasData
      ? confirm({
          title: `${what} entfernen?`,
          message: `Die eingetragenen Werte dieser Zeile (${what}) werden gelöscht.`,
          confirmLabel: "Entfernen",
          danger: true,
        })
      : Promise.resolve(true);

  const updatePositions = <K extends "purchases" | "otherHeatingCosts" | "separateCosts">(
    field: K,
    next: HeatingStatement[K],
  ) => update({ [field]: next } as Pick<HeatingStatement, K>);

  const checks = statement ? plausibility(statement, messdienstCostsTotal ?? null) : [];

  return (
    <Card title={cardTitle}>
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Messdienstleister">
            <TextCell
              value={s.provider}
              placeholder="z. B. BRUNATA-METRONA"
              onCommit={(provider) => void update({ provider })}
            />
          </FormField>
          <FormField label="Energieart">
            <TextCell
              value={s.fuelType}
              placeholder="z. B. Heizöl"
              onCommit={(fuelType) => void update({ fuelType })}
            />
          </FormField>
        </div>

        <div>
          <p className="text-sm font-medium text-fg mb-2">Brennstoff-Bestandsführung</p>
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_8rem_8rem_2rem] gap-2 items-center">
              <span className="text-sm text-fg">Anfangsbestand</span>
              <NumInput
                value={s.openingStock.liters}
                aria-label="Anfangsbestand Liter"
                onChange={(liters) => update({ openingStock: { ...s.openingStock, liters } })}
                suffix="l"
                min={0}
              />
              <NumInput
                value={s.openingStock.amount}
                aria-label="Anfangsbestand Betrag"
                onChange={(amount) => update({ openingStock: { ...s.openingStock, amount } })}
                suffix="€"
                min={0}
              />
              <span />
            </div>
            {s.purchases.map((purchase, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: Zeilen haben keine stabile Identität
                key={i}
                className="grid grid-cols-[1fr_8rem_8rem_2rem] gap-2 items-center"
              >
                <TextCell
                  type="date"
                  aria-label={`Bezug ${i + 1} Datum`}
                  value={purchase.date}
                  onCommit={(date) =>
                    updatePositions(
                      "purchases",
                      s.purchases.map((p, j) => (j === i ? { ...p, date } : p)),
                    )
                  }
                />
                <NumInput
                  value={purchase.liters}
                  aria-label={`Bezug ${i + 1} Liter`}
                  onChange={(liters) =>
                    updatePositions(
                      "purchases",
                      s.purchases.map((p, j) => (j === i ? { ...p, liters } : p)),
                    )
                  }
                  suffix="l"
                  min={0}
                />
                <NumInput
                  value={purchase.amount}
                  aria-label={`Bezug ${i + 1} Betrag`}
                  onChange={(amount) =>
                    updatePositions(
                      "purchases",
                      s.purchases.map((p, j) => (j === i ? { ...p, amount } : p)),
                    )
                  }
                  suffix="€"
                  min={0}
                />
                <IconButton
                  size="sm"
                  aria-label={`Bezug ${i + 1} entfernen`}
                  icon={<Trash2 size={14} />}
                  onClick={async () => {
                    if (!(await confirmRemove(purchase.liters > 0 || purchase.amount > 0, "Bezug")))
                      return;
                    await updatePositions(
                      "purchases",
                      s.purchases.filter((_, j) => j !== i),
                    );
                  }}
                />
              </div>
            ))}
            <div className="grid grid-cols-[1fr_8rem_8rem_2rem] gap-2 items-center">
              <span className="text-sm text-fg">abzüglich Endbestand</span>
              <NumInput
                value={s.closingStock.liters}
                aria-label="Endbestand Liter"
                onChange={(liters) => update({ closingStock: { ...s.closingStock, liters } })}
                suffix="l"
                min={0}
              />
              <NumInput
                value={s.closingStock.amount}
                aria-label="Endbestand Betrag"
                onChange={(amount) => update({ closingStock: { ...s.closingStock, amount } })}
                suffix="€"
                min={0}
              />
              <span />
            </div>
            <div className="grid grid-cols-[1fr_8rem_8rem_2rem] gap-2 items-center">
              <span className="text-sm text-fg">Summe Verbrauch (lt. Abrechnung)</span>
              <NumInput
                value={s.consumption.liters}
                aria-label="Verbrauch Liter"
                onChange={(liters) => update({ consumption: { ...s.consumption, liters } })}
                suffix="l"
                min={0}
              />
              <NumInput
                value={s.consumption.amount}
                aria-label="Verbrauch Betrag"
                onChange={(amount) => update({ consumption: { ...s.consumption, amount } })}
                suffix="€"
                min={0}
              />
              <span />
            </div>
            <div className="flex items-center justify-between pt-1">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={() =>
                  updatePositions("purchases", [
                    ...s.purchases,
                    { date: `${year}-01-01`, liters: 0, amount: 0 },
                  ])
                }
              >
                Bezug hinzufügen
              </Button>
              <span className="text-xs text-fg-muted">
                rechnerisch:{" "}
                {computedConsumptionLiters(s).toLocaleString("de-DE", {
                  maximumFractionDigits: 1,
                })}{" "}
                l
              </span>
            </div>
          </div>
        </div>

        <PositionList
          title="Weitere Heizungsbetriebskosten"
          addLabel="Position hinzufügen"
          placeholder="z. B. Brennerwartung"
          positions={s.otherHeatingCosts}
          onChange={(next) => updatePositions("otherHeatingCosts", next)}
          confirmRemove={confirmRemove}
        />

        <div className="grid grid-cols-[1fr_8rem_2rem] gap-2 items-center">
          <span className="text-sm text-fg">abzgl. Vermieteranteil CO2-Kosten</span>
          <NumInput
            value={s.co2LandlordShare}
            aria-label="Vermieteranteil CO2-Kosten"
            onChange={(co2LandlordShare) => update({ co2LandlordShare })}
            suffix="€"
            min={0}
          />
          <span />
        </div>

        <PositionList
          title="Kosten zur gesonderten Verteilung"
          addLabel="Position hinzufügen"
          placeholder="z. B. Kalt- und Abwasser"
          positions={s.separateCosts}
          onChange={(next) => updatePositions("separateCosts", next)}
          confirmRemove={confirmRemove}
        />

        <div className="grid grid-cols-[1fr_8rem_2rem] gap-2 items-center pt-2 border-t border-border">
          <span className="text-sm font-semibold text-fg">
            Summe der zu verteilenden Kosten (lt. Abrechnung)
          </span>
          <NumInput
            value={s.totalDistributed}
            aria-label="Summe der zu verteilenden Kosten"
            onChange={(totalDistributed) => update({ totalDistributed })}
            suffix="€"
            min={0}
          />
          <span />
        </div>

        {checks.length > 0 && (
          <ul className="space-y-1">
            {checks.map((check) => (
              <li key={check.message} className="flex items-start gap-2 text-xs">
                {check.level === "ok" ? (
                  <CheckCircle2
                    size={14}
                    className="text-success-fg shrink-0 mt-0.5"
                    aria-label="OK"
                  />
                ) : (
                  <AlertTriangle
                    size={14}
                    className="text-warning-fg shrink-0 mt-0.5"
                    aria-label="Warnung"
                  />
                )}
                <span className={check.level === "ok" ? "text-fg-muted" : "text-warning-fg"}>
                  {check.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function PositionList({
  title,
  addLabel,
  placeholder,
  positions,
  onChange,
  confirmRemove,
}: {
  title: string;
  addLabel: string;
  placeholder: string;
  positions: StatementPosition[];
  onChange: (next: StatementPosition[]) => void | Promise<void>;
  confirmRemove: (hasData: boolean, what: string) => Promise<boolean>;
}) {
  const total = positions.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div>
      <p className="text-sm font-medium text-fg mb-2">{title}</p>
      <div className="space-y-2">
        {positions.map((position, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Zeilen haben keine stabile Identität
          <div key={i} className="grid grid-cols-[1fr_8rem_2rem] gap-2 items-center">
            <TextCell
              value={position.label}
              aria-label={`${title}: Position ${i + 1} Bezeichnung`}
              placeholder={placeholder}
              onCommit={(label) =>
                onChange(positions.map((p, j) => (j === i ? { ...p, label } : p)))
              }
            />
            <NumInput
              value={position.amount}
              aria-label={`${title}: Position ${i + 1} Betrag`}
              onChange={(amount) =>
                onChange(positions.map((p, j) => (j === i ? { ...p, amount } : p)))
              }
              suffix="€"
            />
            <IconButton
              size="sm"
              aria-label={`Position ${i + 1} entfernen`}
              icon={<Trash2 size={14} />}
              onClick={async () => {
                const hasData = position.label.trim() !== "" || position.amount !== 0;
                if (!(await confirmRemove(hasData, "Position"))) return;
                await onChange(positions.filter((_, j) => j !== i));
              }}
            />
          </div>
        ))}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() => onChange([...positions, { label: "", amount: 0 }])}
          >
            {addLabel}
          </Button>
          {positions.length > 0 && (
            <span className="text-xs text-fg-muted">Summe: {formatEuro(total)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
