import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Card } from '../../components/shared/Card';
import { NumInput } from '../../components/shared/NumInput';
import { formatEuro } from '../../utils/format';
import type { FinancingData } from '../../db/schema';

export type { FinancingData };

const defaultFinancing: FinancingData = {
  kaufpreis: 0,
  eigenkapital: 0,
  kreditbetrag: 0,
  zinssatz: 0,
  tilgung: 0,
  jaehrlicheKreditrate: 0,
  nichtUmlagefaehigeKosten: 0,
  afaSatz: 2,
};

interface FinancingInputProps {
  propertyId: number;
}

export function FinancingInput({ propertyId }: FinancingInputProps) {
  const settingKey = `financing_${propertyId}`;

  const stored = useLiveQuery(
    () => db.settings.get(settingKey),
    [settingKey],
  );

  const [data, setData] = useState<FinancingData>(defaultFinancing);
  const [dirty, setDirty] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (stored !== undefined) {
      setData(stored?.value ? (stored.value as FinancingData) : defaultFinancing);
      setDirty(false);
    }
  }, [stored]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const update = useCallback(
    (field: keyof FinancingData, value: number) => {
      setData((prev) => {
        const next = { ...prev, [field]: value };

        // Auto-calc Kreditbetrag = Kaufpreis - Eigenkapital
        if (field === 'kaufpreis' || field === 'eigenkapital') {
          const kp = field === 'kaufpreis' ? value : prev.kaufpreis;
          const ek = field === 'eigenkapital' ? value : prev.eigenkapital;
          next.kreditbetrag = Math.max(0, kp - ek);
        }

        // Auto-calc jährliche Kreditrate
        const kb =
          field === 'kreditbetrag' ? value : next.kreditbetrag;
        const zs = field === 'zinssatz' ? value : next.zinssatz;
        const tg = field === 'tilgung' ? value : next.tilgung;
        next.jaehrlicheKreditrate = ((zs + tg) / 100) * kb;

        return next;
      });
      setDirty(true);
    },
    [],
  );

  const handleSave = useCallback(async () => {
    await db.settings.put({ key: settingKey, value: data });
    setDirty(false);
  }, [settingKey, data]);

  return (
    <Card title="Objektdaten & Finanzierung">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <NumInput
          label="Kaufpreis"
          value={data.kaufpreis}
          onChange={(v) => update('kaufpreis', v)}
          suffix="EUR"
          min={0}
        />
        <NumInput
          label="Eigenkapital"
          value={data.eigenkapital}
          onChange={(v) => update('eigenkapital', v)}
          suffix="EUR"
          min={0}
        />
        <NumInput
          label="Kreditbetrag"
          value={data.kreditbetrag}
          onChange={(v) => update('kreditbetrag', v)}
          suffix="EUR"
          min={0}
        />
        <NumInput
          label="Zinssatz"
          value={data.zinssatz}
          onChange={(v) => update('zinssatz', v)}
          suffix="%"
          min={0}
          max={100}
          step={0.1}
        />
        <NumInput
          label="Tilgung"
          value={data.tilgung}
          onChange={(v) => update('tilgung', v)}
          suffix="%"
          min={0}
          max={100}
          step={0.1}
        />
        <div>
          <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
            Jährliche Kreditrate
          </label>
          <div className="w-full border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 rounded-lg px-3 py-1.5 text-sm text-right font-mono text-stone-600 dark:text-stone-300">
            {formatEuro(data.jaehrlicheKreditrate)}
          </div>
        </div>
        <NumInput
          label="Nicht-umlagefähige Kosten / Jahr"
          value={data.nichtUmlagefaehigeKosten}
          onChange={(v) => update('nichtUmlagefaehigeKosten', v)}
          suffix="EUR"
          min={0}
          className="sm:col-span-2 lg:col-span-1"
        />
        <NumInput
          label="AfA-Satz (Anlage V, Zeile 33)"
          value={data.afaSatz}
          onChange={(v) => update('afaSatz', v)}
          suffix="%"
          min={0}
          max={5}
          step={0.5}
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!dirty}
          className="px-4 py-1.5 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Speichern
        </button>
        {dirty && (
          <span className="text-xs text-amber-600">
            Ungespeicherte Änderungen
          </span>
        )}
      </div>
    </Card>
  );
}
