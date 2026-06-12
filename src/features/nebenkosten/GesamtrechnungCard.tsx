import { useState } from "react";
import { db, useLiveQuery } from "../../lib/db";
import type { FuelPurchase, HeatingStatement, StatementPosition } from "../../lib/db/schema";
import { Card } from "../../lib/ui/shared/Card";
import { NumInput } from "../../lib/ui/shared/NumInput";
import { Button, Input } from "../../lib/ui/ui";
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
}: {
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  type?: "text" | "date";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  return (
    <Input
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
  const statement = useLiveQuery(
    () =>
      db.heatingStatements
        .where("propertyId")
        .equals(propertyId)
        .toArray()
        .then((all) => all.find((s) => s.year === year) ?? null),
    [propertyId, year],
  );

  // Summe der erfassten Messdienst-Kosten des Jahres für den Quercheck.
  const messdienstCostsTotal = useLiveQuery(async () => {
    const [costTypes, costs] = await Promise.all([
      db.costTypes.toArray(),
      db.costs.where("propertyId").equals(propertyId).toArray(),
    ]);
    const messdienstIds = new Set(
      costTypes.filter((ct) => ct.distribution === "messdienst").map((ct) => ct.id!),
    );
    const relevant = costs.filter(
      (c) => c.year === year && messdienstIds.has(c.costTypeId) && c.totalAmount > 0,
    );
    if (relevant.length === 0) return null;
    return relevant.reduce((sum, c) => sum + c.totalAmount, 0);
  }, [propertyId, year]);

  if (statement === undefined) return null;

  const s = statement ?? emptyStatement(propertyId, year);

  const update = async (patch: Partial<HeatingStatement>) => {
    if (statement?.id) {
      await db.heatingStatements.update(statement.id, patch);
    } else {
      await db.heatingStatements.add({ ...emptyStatement(propertyId, year), ...patch });
    }
  };

  const updatePositions = (
    field: "purchases" | "otherHeatingCosts" | "separateCosts",
    next: FuelPurchase[] | StatementPosition[],
  ) => update({ [field]: next });

  const checks = statement ? plausibility(statement, messdienstCostsTotal ?? null) : [];

  return (
    <Card title={`Gesamtrechnung (Gebäude) ${year} – Brennstoff & Heizungsbetriebskosten`}>
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <span className="block text-xs font-medium text-fg-muted mb-1">Messdienstleister</span>
            <TextCell
              value={s.provider}
              placeholder="z. B. BRUNATA-METRONA"
              onCommit={(provider) => update({ provider })}
            />
          </div>
          <div>
            <span className="block text-xs font-medium text-fg-muted mb-1">Energieart</span>
            <TextCell
              value={s.fuelType}
              placeholder="z. B. Heizöl"
              onCommit={(fuelType) => update({ fuelType })}
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-fg mb-2">Brennstoff-Bestandsführung</p>
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_8rem_8rem_2rem] gap-2 items-center">
              <span className="text-sm text-fg">Anfangsbestand</span>
              <NumInput
                value={s.openingStock.liters}
                onChange={(liters) => update({ openingStock: { ...s.openingStock, liters } })}
                suffix="l"
                min={0}
              />
              <NumInput
                value={s.openingStock.amount}
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
                  onChange={(amount) =>
                    updatePositions(
                      "purchases",
                      s.purchases.map((p, j) => (j === i ? { ...p, amount } : p)),
                    )
                  }
                  suffix="€"
                  min={0}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Bezug entfernen"
                  onClick={() =>
                    updatePositions(
                      "purchases",
                      s.purchases.filter((_, j) => j !== i),
                    )
                  }
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_8rem_8rem_2rem] gap-2 items-center">
              <span className="text-sm text-fg">abzüglich Endbestand</span>
              <NumInput
                value={s.closingStock.liters}
                onChange={(liters) => update({ closingStock: { ...s.closingStock, liters } })}
                suffix="l"
                min={0}
              />
              <NumInput
                value={s.closingStock.amount}
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
                onChange={(liters) => update({ consumption: { ...s.consumption, liters } })}
                suffix="l"
                min={0}
              />
              <NumInput
                value={s.consumption.amount}
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
        />

        <div className="grid grid-cols-[1fr_8rem_2rem] gap-2 items-center">
          <span className="text-sm text-fg">abzgl. Vermieteranteil CO2-Kosten</span>
          <NumInput
            value={s.co2LandlordShare}
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
        />

        <div className="grid grid-cols-[1fr_8rem_2rem] gap-2 items-center pt-2 border-t border-border">
          <span className="text-sm font-semibold text-fg">
            Summe der zu verteilenden Kosten (lt. Abrechnung)
          </span>
          <NumInput
            value={s.totalDistributed}
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
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                )}
                <span className={check.level === "ok" ? "text-fg-muted" : "text-amber-600"}>
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
}: {
  title: string;
  addLabel: string;
  placeholder: string;
  positions: StatementPosition[];
  onChange: (next: StatementPosition[]) => void;
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
              placeholder={placeholder}
              onCommit={(label) =>
                onChange(positions.map((p, j) => (j === i ? { ...p, label } : p)))
              }
            />
            <NumInput
              value={position.amount}
              onChange={(amount) =>
                onChange(positions.map((p, j) => (j === i ? { ...p, amount } : p)))
              }
              suffix="€"
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label="Position entfernen"
              onClick={() => onChange(positions.filter((_, j) => j !== i))}
            >
              <Trash2 size={14} />
            </Button>
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
