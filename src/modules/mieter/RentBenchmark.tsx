import { useState, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Card } from '../../components/shared/Card';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { NumInput } from '../../components/shared/NumInput';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatEuro, formatNumber } from '../../utils/format';
import type { Unit, Occupancy } from '../../db/schema';

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
  ampel: 'green' | 'yellow' | 'red';
  ampelLabel: string;
  potential: number | null;
}

const DEFAULT_SETTINGS: MietspiegelSettings = {
  pricePerSqm: 0,
  source: '',
  validUntil: '',
};

export function RentBenchmark({ propertyId, units, occupancies }: RentBenchmarkProps) {
  const settingsKey = `mietspiegel_${propertyId}`;

  const stored = useLiveQuery(
    () => db.settings.get(settingsKey),
    [settingsKey],
  );

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

  const saveSettings = useCallback(
    async (next: MietspiegelSettings) => {
      setSettings(next);
      await db.settings.put({ key: settingsKey, value: next });
    },
    [settingsKey],
  );

  const rows = useMemo((): BenchmarkRow[] => {
    if (settings.pricePerSqm <= 0) return [];

    const now = new Date().toISOString().slice(0, 7);

    return units.map((unit) => {
      const active = occupancies.find(
        (o) => o.unitId === unit.id && o.from <= now && (o.to === null || o.to >= now),
      ) ?? null;

      const rentCold = active?.rentCold ?? 0;
      const area = unit.area || 0;
      const rentPerSqm = area > 0 ? rentCold / area : 0;
      const mietspiegelPerSqm = settings.pricePerSqm;
      const diff = rentPerSqm - mietspiegelPerSqm;

      // Tolerance: within +/-10% of mietspiegel
      const tolerance = mietspiegelPerSqm * 0.1;
      let ampel: 'green' | 'yellow' | 'red';
      let ampelLabel: string;

      if (diff < -tolerance) {
        ampel = 'green';
        ampelLabel = 'Unter Mietspiegel';
      } else if (diff > tolerance) {
        ampel = 'red';
        ampelLabel = 'Über Mietspiegel';
      } else {
        ampel = 'yellow';
        ampelLabel = 'Im Rahmen';
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
      key: 'name',
      header: 'Wohnung',
      render: (r) => <span className="font-medium">{r.unit.name}</span>,
      sortValue: (r) => r.unit.name,
    },
    {
      key: 'area',
      header: 'Fläche',
      render: (r) => <span className="font-mono">{formatNumber(r.area)} m²</span>,
      align: 'right',
      sortValue: (r) => r.area,
    },
    {
      key: 'rentCold',
      header: 'Kaltmiete',
      render: (r) =>
        r.occupancy ? (
          <span className="font-mono">{formatEuro(r.rentCold)}</span>
        ) : (
          <span className="text-stone-400 dark:text-stone-500">Leerstand</span>
        ),
      align: 'right',
      sortValue: (r) => r.rentCold,
    },
    {
      key: 'rentPerSqm',
      header: 'Kaltmiete/m²',
      render: (r) =>
        r.area > 0 ? (
          <span className="font-mono">{formatNumber(r.rentPerSqm)} €</span>
        ) : (
          <span className="text-stone-400 dark:text-stone-500">–</span>
        ),
      align: 'right',
      sortValue: (r) => r.rentPerSqm,
    },
    {
      key: 'mietspiegel',
      header: 'Mietspiegel/m²',
      render: (r) => <span className="font-mono">{formatNumber(r.mietspiegelPerSqm)} €</span>,
      align: 'right',
    },
    {
      key: 'diff',
      header: 'Differenz',
      render: (r) => {
        if (r.area <= 0) return <span className="text-stone-400 dark:text-stone-500">–</span>;
        const cls = r.diff > 0 ? 'text-red-600 dark:text-red-400' : r.diff < 0 ? 'text-green-600 dark:text-green-400' : '';
        return (
          <span className={`font-mono ${cls}`}>
            {r.diff > 0 ? '+' : ''}{formatNumber(r.diff)} €
          </span>
        );
      },
      align: 'right',
      sortValue: (r) => r.diff,
    },
    {
      key: 'ampel',
      header: 'Ampel',
      render: (r) => r.area > 0 ? <StatusBadge status={r.ampel} label={r.ampelLabel} /> : null,
    },
  ];

  const totalPotential = rows.reduce((sum, r) => sum + (r.potential ?? 0), 0);

  return (
    <Card title="Mietspiegel-Vergleich">
      {/* Settings inputs */}
      <div className="mb-4 p-4 bg-stone-50 dark:bg-stone-800/50 rounded-lg border border-stone-200 dark:border-stone-700">
        <h3 className="text-sm font-semibold text-stone-700 dark:text-stone-200 mb-3">
          Ortsübliche Vergleichsmiete
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <NumInput
            label="Vergleichsmiete pro m²"
            value={settings.pricePerSqm}
            onChange={(v) => saveSettings({ ...settings, pricePerSqm: v })}
            suffix="€/m²"
            min={0}
          />
          <div>
            <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
              Quelle
            </label>
            <input
              type="text"
              value={settings.source}
              onChange={(e) => saveSettings({ ...settings, source: e.target.value })}
              placeholder="z.B. Mietspiegel 2025 Stadt XY"
              className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
              Gültig bis
            </label>
            <input
              type="month"
              value={settings.validUntil}
              onChange={(e) => saveSettings({ ...settings, validUntil: e.target.value })}
              className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
            />
          </div>
        </div>
      </div>

      {/* Comparison table */}
      {settings.pricePerSqm > 0 ? (
        <>
          <DataTable columns={columns} data={rows} keyFn={(r) => r.unit.id!} />

          {/* Potential summary */}
          {totalPotential > 0 && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
              <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">
                Erhöhungspotenzial
              </p>
              <ul className="space-y-1">
                {rows
                  .filter((r) => r.potential !== null && r.potential > 0)
                  .map((r) => (
                    <li key={r.unit.id} className="text-sm text-green-600 dark:text-green-400">
                      <span className="font-medium">{r.unit.name}:</span>{' '}
                      Erhöhung möglich um{' '}
                      <span className="font-mono">{formatEuro(r.potential!)}</span>{' '}
                      (auf {formatNumber(r.mietspiegelPerSqm)} €/m²)
                    </li>
                  ))}
              </ul>
              <p className="mt-2 text-sm font-mono font-semibold text-green-700 dark:text-green-300">
                Gesamt: {formatEuro(totalPotential)} / Monat
              </p>
            </div>
          )}

          {/* Legal note */}
          <div className="mt-4 p-3 bg-stone-50 dark:bg-stone-700/30 rounded-lg">
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Beachten Sie die Kappungsgrenze von 20% innerhalb von 3 Jahren (§ 558 Abs. 3 BGB).
            </p>
          </div>
        </>
      ) : (
        <p className="text-sm text-stone-500 dark:text-stone-400 text-center py-4">
          Geben Sie die ortsübliche Vergleichsmiete ein, um den Vergleich zu starten.
        </p>
      )}
    </Card>
  );
}
