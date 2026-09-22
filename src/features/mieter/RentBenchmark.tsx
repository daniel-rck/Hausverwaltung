import { useCallback, useMemo, useState } from "react";
import { db, useLiveQuery } from "../../lib/db";
import type { Occupancy, Unit } from "../../lib/db/schema";
import { Card } from "../../lib/ui/shared/Card";
import { type Column, DataTable } from "../../lib/ui/shared/DataTable";
import { NumInput } from "../../lib/ui/shared/NumInput";
import { StatusBadge } from "../../lib/ui/shared/StatusBadge";
import { Callout, FormField, Input, useToast } from "../../lib/ui/ui";
import { currentMonth } from "../../lib/utils/dates";
import { formatEuro, formatNumber } from "../../lib/utils/format";

interface RentBenchmarkProps {
  propertyId: number;
  units: Unit[];
  occupancies: Occupancy[];
}

interface MietspiegelSettings {
  pricePerSqm: number;
  source: string;
  validUntil: string;
}

interface BenchmarkRow {
  unit: Unit;
  occupancy: Occupancy | null;
  area: number;
  rentCold: number;
  rentPerSqm: number;
  mietspiegelPerSqm: number;
  diff: number;
  ampel: "green" | "yellow" | "red";
  ampelLabel: string;
  potential: number | null;
}

const DEFAULT_SETTINGS: MietspiegelSettings = {
  pricePerSqm: 0,
  source: "",
  validUntil: "",
};

export function RentBenchmark({ propertyId, units, occupancies }: RentBenchmarkProps) {
  const settingsKey = `mietspiegel_${propertyId}`;

  const stored = useLiveQuery(() => db.settings.get(settingsKey), [settingsKey]);

  const [settings, setSettings] = useState<MietspiegelSettings>(DEFAULT_SETTINGS);
  const [initialized, setInitialized] = useState(false);

  // Sync stored settings into local state when loaded
  if (stored && !initialized) {
    const val = stored.value as MietspiegelSettings;
    setSettings(val);
    setInitialized(true);
  }
  if (stored === undefined && initialized) {
    setInitialized(false);
  }

  const toast = useToast();

  const saveSettings = useCallback(
    async (next: MietspiegelSettings) => {
      setSettings(next);
      try {
        await db.settings.put({ key: settingsKey, value: next });
      } catch (err) {
        toast.error("Speichern fehlgeschlagen.");
        console.error(err);
      }
    },
    [settingsKey, toast],
  );

  const rows = useMemo((): BenchmarkRow[] => {
    if (settings.pricePerSqm <= 0) return [];

    const now = currentMonth();

    return units.map((unit) => {
      const active =
        occupancies.find(
          (o) => o.unitId === unit.id && o.from <= now && (o.to === null || o.to >= now),
        ) ?? null;

      const rentCold = active?.rentCold ?? 0;
      const area = unit.area || 0;
      const rentPerSqm = area > 0 ? rentCold / area : 0;
      const mietspiegelPerSqm = settings.pricePerSqm;
      const diff = rentPerSqm - mietspiegelPerSqm;

      // Tolerance: within +/-10% of mietspiegel
      const tolerance = mietspiegelPerSqm * 0.1;
      let ampel: "green" | "yellow" | "red";
      let ampelLabel: string;

      if (diff < -tolerance) {
        ampel = "green";
        ampelLabel = "Unter Mietspiegel";
      } else if (diff > tolerance) {
        ampel = "red";
        ampelLabel = "Über Mietspiegel";
      } else {
        ampel = "yellow";
        ampelLabel = "Im Rahmen";
      }

      // Potential: only if current rent is below mietspiegel
      const targetRent = mietspiegelPerSqm * area;
      const potential = rentCold < targetRent && area > 0 ? targetRent - rentCold : null;

      return {
        unit,
        occupancy: active,
        area,
        rentCold,
        rentPerSqm,
        mietspiegelPerSqm,
        diff,
        ampel,
        ampelLabel,
        potential,
      };
    });
  }, [units, occupancies, settings.pricePerSqm]);

  const columns: Column<BenchmarkRow>[] = [
    {
      key: "name",
      header: "Wohnung",
      render: (r) => <span className="font-medium">{r.unit.name}</span>,
      sortValue: (r) => r.unit.name,
    },
    {
      key: "area",
      header: "Fläche",
      render: (r) => <span className="font-mono">{formatNumber(r.area)} m²</span>,
      align: "right",
      sortValue: (r) => r.area,
    },
    {
      key: "rentCold",
      header: "Kaltmiete",
      render: (r) =>
        r.occupancy ? (
          <span className="font-mono">{formatEuro(r.rentCold)}</span>
        ) : (
          <span className="text-fg-subtle">Leerstand</span>
        ),
      align: "right",
      sortValue: (r) => r.rentCold,
    },
    {
      key: "rentPerSqm",
      header: "Kaltmiete/m²",
      render: (r) =>
        r.area > 0 ? (
          <span className="font-mono">{formatNumber(r.rentPerSqm)} €</span>
        ) : (
          <span className="text-fg-subtle">–</span>
        ),
      align: "right",
      sortValue: (r) => r.rentPerSqm,
    },
    {
      key: "mietspiegel",
      header: "Mietspiegel/m²",
      render: (r) => <span className="font-mono">{formatNumber(r.mietspiegelPerSqm)} €</span>,
      align: "right",
    },
    {
      key: "diff",
      header: "Differenz",
      render: (r) => {
        if (r.area <= 0) return <span className="text-fg-subtle">–</span>;
        const cls = r.diff > 0 ? "text-danger-fg" : r.diff < 0 ? "text-success-fg" : "";
        return (
          <span className={`font-mono ${cls}`}>
            {r.diff > 0 ? "+" : ""}
            {formatNumber(r.diff)} €
          </span>
        );
      },
      align: "right",
      sortValue: (r) => r.diff,
    },
    {
      key: "ampel",
      header: "Ampel",
      render: (r) => (r.area > 0 ? <StatusBadge status={r.ampel} label={r.ampelLabel} /> : null),
    },
  ];

  const totalPotential = rows.reduce((sum, r) => sum + (r.potential ?? 0), 0);

  return (
    <Card title="Mietspiegel-Vergleich">
      {/* Settings inputs */}
      <div className="mb-4 p-4 bg-surface-muted rounded-lg border border-border">
        <h3 className="text-sm font-semibold text-fg mb-3">Ortsübliche Vergleichsmiete</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Vergleichsmiete pro m²">
            <NumInput
              value={settings.pricePerSqm}
              onChange={(v) => void saveSettings({ ...settings, pricePerSqm: v })}
              suffix="€/m²"
              min={0}
            />
          </FormField>
          <FormField label="Quelle">
            <Input
              value={settings.source}
              onChange={(e) => void saveSettings({ ...settings, source: e.target.value })}
              placeholder="z.B. Mietspiegel 2025 Stadt XY"
            />
          </FormField>
          <FormField label="Gültig bis">
            <Input
              type="month"
              value={settings.validUntil}
              onChange={(e) => void saveSettings({ ...settings, validUntil: e.target.value })}
            />
          </FormField>
        </div>
      </div>

      {/* Comparison table */}
      {settings.pricePerSqm > 0 ? (
        <>
          <DataTable columns={columns} data={rows} keyFn={(r) => r.unit.id ?? r.unit.name} />

          {/* Potential summary */}
          {totalPotential > 0 && (
            <Callout variant="success" title="Erhöhungspotenzial" className="mt-4">
              <ul className="space-y-1">
                {rows.flatMap((r) =>
                  r.potential !== null && r.potential > 0
                    ? [
                        <li key={r.unit.id ?? r.unit.name}>
                          <span className="font-medium text-fg">{r.unit.name}:</span> Erhöhung
                          möglich um <span className="font-mono">{formatEuro(r.potential)}</span>{" "}
                          (auf {formatNumber(r.mietspiegelPerSqm)} €/m²)
                        </li>,
                      ]
                    : [],
                )}
              </ul>
              <p className="mt-2 font-mono font-semibold text-success-fg">
                Gesamt: {formatEuro(totalPotential)} / Monat
              </p>
            </Callout>
          )}

          {/* Legal note */}
          <div className="mt-4 p-3 bg-surface-sunken rounded-lg">
            <p className="text-xs text-fg-muted">
              Beachten Sie die Kappungsgrenze von 20% innerhalb von 3 Jahren (§ 558 Abs. 3 BGB).
            </p>
          </div>
        </>
      ) : (
        <p className="text-sm text-fg-muted text-center py-4">
          Geben Sie die ortsübliche Vergleichsmiete ein, um den Vergleich zu starten.
        </p>
      )}
    </Card>
  );
}
