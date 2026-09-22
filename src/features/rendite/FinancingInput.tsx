import { useCallback, useEffect, useState } from "react";
import { db, useLiveQuery } from "../../lib/db";
import type { FinancingData } from "../../lib/db/schema";
import { Card } from "../../lib/ui/shared/Card";
import { NumInput } from "../../lib/ui/shared/NumInput";
import { Button, FormField, Input, Skeleton, useToast } from "../../lib/ui/ui";
import { formatEuro } from "../../lib/utils/format";

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

const FIELD_SKELETON_KEYS = ["kp", "ek", "kb", "zs", "tg", "rate", "nuk", "afa"] as const;

interface FinancingInputProps {
  propertyId: number;
}

export function FinancingInput({ propertyId }: FinancingInputProps) {
  const settingKey = `financing_${propertyId}`;

  // `null` = geladen, aber noch nicht gespeichert; `undefined` = lädt noch.
  const stored = useLiveQuery(
    async () => (await db.settings.get(settingKey)) ?? null,
    [settingKey],
  );
  const toast = useToast();
  const [saving, setSaving] = useState(false);

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

  const update = useCallback((field: keyof FinancingData, value: number) => {
    setData((prev) => {
      const next = { ...prev, [field]: value };

      // Auto-calc Kreditbetrag = Kaufpreis - Eigenkapital
      if (field === "kaufpreis" || field === "eigenkapital") {
        const kp = field === "kaufpreis" ? value : prev.kaufpreis;
        const ek = field === "eigenkapital" ? value : prev.eigenkapital;
        next.kreditbetrag = Math.max(0, kp - ek);
      }

      // Auto-calc jährliche Kreditrate
      const kb = field === "kreditbetrag" ? value : next.kreditbetrag;
      const zs = field === "zinssatz" ? value : next.zinssatz;
      const tg = field === "tilgung" ? value : next.tilgung;
      next.jaehrlicheKreditrate = ((zs + tg) / 100) * kb;

      return next;
    });
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await db.settings.put({ key: settingKey, value: data });
      setDirty(false);
      toast.success("Finanzierungsdaten gespeichert.");
    } catch (err) {
      toast.error("Speichern fehlgeschlagen.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [settingKey, data, toast]);

  if (stored === undefined) {
    return (
      <Card title="Objektdaten & Finanzierung">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FIELD_SKELETON_KEYS.map((k) => (
            <Skeleton key={k} height="3.5rem" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card title="Objektdaten & Finanzierung">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NumInput
            label="Kaufpreis"
            value={data.kaufpreis}
            onChange={(v) => update("kaufpreis", v)}
            suffix="EUR"
            min={0}
          />
          <NumInput
            label="Eigenkapital"
            value={data.eigenkapital}
            onChange={(v) => update("eigenkapital", v)}
            suffix="EUR"
            min={0}
          />
          <NumInput
            label="Kreditbetrag"
            value={data.kreditbetrag}
            onChange={(v) => update("kreditbetrag", v)}
            suffix="EUR"
            min={0}
          />
          <NumInput
            label="Zinssatz"
            value={data.zinssatz}
            onChange={(v) => update("zinssatz", v)}
            suffix="%"
            min={0}
            max={100}
          />
          <NumInput
            label="Tilgung"
            value={data.tilgung}
            onChange={(v) => update("tilgung", v)}
            suffix="%"
            min={0}
            max={100}
          />
          <FormField label="Jährliche Kreditrate" hint="Automatisch berechnet">
            <Input
              readOnly
              tabIndex={-1}
              value={formatEuro(data.jaehrlicheKreditrate)}
              className="text-right font-mono bg-surface-muted text-fg-muted"
            />
          </FormField>
          <NumInput
            label="Nicht-umlagefähige Kosten / Jahr"
            value={data.nichtUmlagefaehigeKosten}
            onChange={(v) => update("nichtUmlagefaehigeKosten", v)}
            suffix="EUR"
            min={0}
            className="sm:col-span-2 lg:col-span-1"
          />
          <NumInput
            label="AfA-Satz (Anlage V, Zeile 33)"
            value={data.afaSatz}
            onChange={(v) => update("afaSatz", v)}
            suffix="%"
            min={0}
            max={5}
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={!dirty} loading={saving}>
            Speichern
          </Button>
          {dirty && <span className="text-xs text-warning-fg">Ungespeicherte Änderungen</span>}
        </div>
      </form>
    </Card>
  );
}
