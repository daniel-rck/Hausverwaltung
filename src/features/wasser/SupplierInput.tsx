import { useCallback, useState } from "react";
import { db, deleteWithTombstone, useLiveQuery } from "../../lib/db";
import type { SupplierBill } from "../../lib/db/schema";
import { useProperty } from "../../lib/hooks/useProperty";
import { Card } from "../../lib/ui/shared/Card";
import { type Column, DataTable } from "../../lib/ui/shared/DataTable";
import { NumInput } from "../../lib/ui/shared/NumInput";
import {
  Button,
  FormField,
  Input,
  required,
  Select,
  useConfirm,
  useFormValidation,
  useToast,
  type ValidationSchema,
} from "../../lib/ui/ui";
import { formatDate, formatEuro, formatNumber } from "../../lib/utils/format";
import { type SupplierType, typeConfig } from "./supplierConfig";

interface SupplierInputProps {
  year: number;
  type: SupplierType;
}

type BillForm = {
  supplier: string;
  totalAmount: number;
  totalConsumption: number;
  unit: string;
  billingFrom: string;
  billingTo: string;
  notes: string;
};

const positive = (message: string) => (value: unknown) =>
  typeof value === "number" && value > 0 ? null : message;

const billSchema: ValidationSchema<BillForm> = {
  supplier: required("Bitte Versorger angeben"),
  totalAmount: positive("Bitte Betrag größer 0 angeben"),
  totalConsumption: positive("Bitte Verbrauch größer 0 angeben"),
  billingFrom: required("Bitte Beginn angeben"),
  billingTo: (value, values) => {
    if (typeof value !== "string" || value === "") return "Bitte Ende angeben";
    if (values.billingFrom && value < values.billingFrom) return "Ende liegt vor Beginn";
    return null;
  },
};

function makeEmptyForm(type: SupplierType): BillForm {
  return {
    supplier: "",
    totalAmount: 0,
    totalConsumption: 0,
    unit: typeConfig[type].defaultUnit,
    billingFrom: "",
    billingTo: "",
    notes: "",
  };
}

export function SupplierInput({ year, type }: SupplierInputProps) {
  const { activeProperty } = useProperty();
  const [form, setForm] = useState<BillForm>(() => makeEmptyForm(type));
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const { errors, validate } = useFormValidation<BillForm>(billSchema);

  const config = typeConfig[type];
  const propertyId = activeProperty?.id;

  const bills = useLiveQuery(
    () =>
      propertyId != null
        ? db.supplierBills
            .where("[year+type]")
            .equals([year, type])
            .filter((b) => b.propertyId === propertyId)
            .toArray()
        : Promise.resolve([] as SupplierBill[]),
    [year, type, propertyId],
  );

  const handleSave = useCallback(async () => {
    if (!propertyId) return;
    if (!validate(form)) return;
    setSaving(true);
    try {
      const bill: Omit<SupplierBill, "id"> = {
        propertyId,
        year,
        type,
        supplier: form.supplier.trim(),
        totalAmount: form.totalAmount,
        totalConsumption: form.totalConsumption,
        unit: form.unit,
        billingFrom: form.billingFrom,
        billingTo: form.billingTo,
        notes: form.notes.trim() || undefined,
      };
      await db.supplierBills.add(bill as SupplierBill);
      setForm(makeEmptyForm(type));
      toast.success("Rechnung gespeichert.");
    } catch (err) {
      toast.error("Speichern fehlgeschlagen.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [propertyId, year, type, form, validate, toast]);

  const handleDelete = useCallback(
    async (bill: SupplierBill) => {
      if (bill.id == null) return;
      const ok = await confirm({
        title: "Rechnung löschen?",
        message: `Die Rechnung von „${bill.supplier}“ (${formatDate(bill.billingFrom)} – ${formatDate(bill.billingTo)}) wird unwiderruflich gelöscht.`,
        confirmLabel: "Löschen",
        danger: true,
      });
      if (!ok) return;
      try {
        await deleteWithTombstone("supplierBills", bill.id);
        toast.success("Rechnung gelöscht.");
      } catch (err) {
        toast.error("Löschen fehlgeschlagen.");
        console.error(err);
      }
    },
    [confirm, toast],
  );

  const columns: Column<SupplierBill>[] = [
    {
      key: "supplier",
      header: "Versorger",
      render: (row) => row.supplier,
      sortValue: (row) => row.supplier,
    },
    {
      key: "totalAmount",
      header: "Betrag",
      align: "right",
      render: (row) => formatEuro(row.totalAmount),
      sortValue: (row) => row.totalAmount,
    },
    {
      key: "totalConsumption",
      header: "Verbrauch",
      align: "right",
      render: (row) => `${formatNumber(row.totalConsumption)} ${row.unit}`,
      sortValue: (row) => row.totalConsumption,
    },
    {
      key: "billingFrom",
      header: "Von",
      render: (row) => formatDate(row.billingFrom),
      sortValue: (row) => row.billingFrom,
    },
    {
      key: "billingTo",
      header: "Bis",
      render: (row) => formatDate(row.billingTo),
      sortValue: (row) => row.billingTo,
    },
    {
      key: "actions",
      header: "",
      align: "center",
      render: (row) => (
        <Button variant="dangerGhost" size="sm" onClick={() => void handleDelete(row)}>
          Löschen
        </Button>
      ),
    },
  ];

  return (
    <Card title={`${config.label} – Daten eingeben`}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <FormField label={config.label} required error={errors.supplier}>
            <Input
              value={form.supplier}
              onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
              placeholder="z.B. Stadtwerke"
            />
          </FormField>
          <FormField label="Gesamtbetrag" required error={errors.totalAmount}>
            <NumInput
              suffix="€"
              value={form.totalAmount}
              onChange={(v) => setForm((f) => ({ ...f, totalAmount: v }))}
              min={0}
            />
          </FormField>
          <div className="flex gap-2 items-start">
            <div className="flex-1 min-w-0">
              <FormField label="Gesamtverbrauch" required error={errors.totalConsumption}>
                <NumInput
                  suffix={form.unit}
                  value={form.totalConsumption}
                  onChange={(v) => setForm((f) => ({ ...f, totalConsumption: v }))}
                  min={0}
                />
              </FormField>
            </div>
            {config.units.length > 1 && (
              <FormField label="Einheit">
                <Select
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  className="w-24"
                >
                  {config.units.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
          </div>
          <FormField label="Abrechnungszeitraum von" required error={errors.billingFrom}>
            <Input
              type="date"
              value={form.billingFrom}
              onChange={(e) => setForm((f) => ({ ...f, billingFrom: e.target.value }))}
            />
          </FormField>
          <FormField label="Abrechnungszeitraum bis" required error={errors.billingTo}>
            <Input
              type="date"
              value={form.billingTo}
              onChange={(e) => setForm((f) => ({ ...f, billingTo: e.target.value }))}
            />
          </FormField>
          <FormField label="Hinweise">
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="optional"
            />
          </FormField>
        </div>
        <div className="flex justify-end mb-6">
          <Button type="submit" variant="primary" loading={saving} disabled={!propertyId}>
            Rechnung speichern
          </Button>
        </div>
      </form>

      <h3 className="text-sm font-medium text-fg-muted mb-2">Erfasste Rechnungen ({year})</h3>
      <DataTable
        columns={columns}
        data={bills ?? []}
        keyFn={(row) => row.id ?? 0}
        emptyMessage="Keine Versorger-Rechnungen für dieses Jahr vorhanden."
      />
    </Card>
  );
}
