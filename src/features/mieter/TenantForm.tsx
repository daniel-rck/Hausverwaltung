import { useState } from "react";
import { db, useLiveQuery } from "../../lib/db";
import { cascadeDeleteOccupancy } from "../../lib/db/cascade";
import type { Occupancy, Tenant, Unit } from "../../lib/db/schema";
import { Card } from "../../lib/ui/shared/Card";
import { type Column, DataTable } from "../../lib/ui/shared/DataTable";
import { NumInput } from "../../lib/ui/shared/NumInput";
import { StatusBadge } from "../../lib/ui/shared/StatusBadge";
import {
  Button,
  Checkbox,
  email,
  FormField,
  Input,
  min,
  required,
  Select,
  Skeleton,
  useConfirm,
  useFormValidation,
  useToast,
  type ValidationSchema,
} from "../../lib/ui/ui";
import { Plus } from "../../lib/ui/ui/icons";
import { currentMonth } from "../../lib/utils/dates";
import { formatEuro, formatMonth } from "../../lib/utils/format";
import { ContractTemplate } from "./ContractTemplate";
import { DepositManager } from "./DepositManager";
import { DocumentStore } from "./DocumentStore";
import { RentHistory } from "./RentHistory";

interface TenantFormProps {
  unit: Unit;
  onBack: () => void;
}

interface OccupancyRow {
  occupancy: Occupancy;
  tenant: Tenant | null;
}

type TenantFormValues = { name: string; email: string; phone: string; notes: string };

const EMPTY_TENANT: TenantFormValues = { name: "", email: "", phone: "", notes: "" };

const tenantSchema: ValidationSchema<TenantFormValues> = {
  name: required("Bitte Namen angeben"),
  email: email("Ungültige E-Mail-Adresse"),
};

type OccFormValues = {
  tenantId: string;
  persons: string;
  from: string;
  to: string;
  rentCold: number;
  rentUtilities: number;
  deposit: number;
  depositPaid: boolean;
};

const EMPTY_OCC: OccFormValues = {
  tenantId: "",
  persons: "1",
  from: "",
  to: "",
  rentCold: 0,
  rentUtilities: 0,
  deposit: 0,
  depositPaid: false,
};

const occSchema: ValidationSchema<OccFormValues> = {
  tenantId: required("Bitte Mieter wählen"),
  persons: min(1, "Mindestens 1 Person"),
  from: required("Bitte Einzugsmonat angeben"),
  to: (value, values) =>
    typeof value === "string" && value !== "" && values.from !== "" && value < values.from
      ? "Auszug darf nicht vor dem Einzug liegen"
      : null,
};

export function TenantForm({ unit, onBack }: TenantFormProps) {
  const [showTenantForm, setShowTenantForm] = useState(false);
  const [showOccForm, setShowOccForm] = useState(false);
  const [contractOcc, setContractOcc] = useState<{ occupancy: Occupancy; tenant: Tenant } | null>(
    null,
  );
  const [tenantForm, setTenantForm] = useState<TenantFormValues>(EMPTY_TENANT);
  const toast = useToast();
  const confirm = useConfirm();
  const tenantValidation = useFormValidation<TenantFormValues>(tenantSchema);
  const occValidation = useFormValidation<OccFormValues>(occSchema);

  const tenants = useLiveQuery(async () => {
    if (unit.id == null) return [];
    return db.tenants.where("unitId").equals(unit.id).toArray();
  }, [unit.id]);

  const rows = useLiveQuery(async () => {
    if (unit.id == null) return [];
    const occupancies = await db.occupancies.where("unitId").equals(unit.id).toArray();

    const result: OccupancyRow[] = [];
    for (const occ of occupancies) {
      const tenant = (await db.tenants.get(occ.tenantId)) ?? null;
      result.push({ occupancy: occ, tenant });
    }

    return result.sort((a, b) => b.occupancy.from.localeCompare(a.occupancy.from));
  }, [unit.id]);

  const closeTenantForm = () => {
    setTenantForm(EMPTY_TENANT);
    tenantValidation.clear();
    setShowTenantForm(false);
  };

  const handleSaveTenant = async () => {
    if (unit.id == null) return;
    if (!tenantValidation.validate(tenantForm)) return;

    try {
      await db.tenants.add({
        unitId: unit.id,
        name: tenantForm.name.trim(),
        email: tenantForm.email || undefined,
        phone: tenantForm.phone || undefined,
        notes: tenantForm.notes || undefined,
      });
      toast.success("Mieter angelegt.");
      closeTenantForm();
    } catch (err) {
      toast.error("Speichern fehlgeschlagen.");
      console.error(err);
    }
  };

  // Occupancy form state
  const [occForm, setOccForm] = useState<OccFormValues>(EMPTY_OCC);

  const closeOccForm = () => {
    setOccForm(EMPTY_OCC);
    occValidation.clear();
    setShowOccForm(false);
  };

  const handleSaveOccupancy = async () => {
    if (unit.id == null) return;
    if (!occValidation.validate(occForm)) return;
    const tenantId = parseInt(occForm.tenantId, 10);
    if (!tenantId) {
      occValidation.setError("tenantId", "Bitte Mieter wählen");
      return;
    }

    try {
      await db.occupancies.add({
        unitId: unit.id,
        tenantId,
        persons: parseInt(occForm.persons, 10) || 1,
        from: occForm.from,
        to: occForm.to || null,
        rentCold: occForm.rentCold,
        rentUtilities: occForm.rentUtilities,
        deposit: occForm.deposit,
        depositPaid: occForm.depositPaid,
      });
      toast.success("Belegung gespeichert.");
      closeOccForm();
    } catch (err) {
      toast.error("Speichern fehlgeschlagen.");
      console.error(err);
    }
  };

  const handleDeleteOccupancy = async (row: OccupancyRow) => {
    const id = row.occupancy.id;
    if (id == null) return;
    const who = row.tenant ? ` von „${row.tenant.name}“` : "";
    const ok = await confirm({
      title: "Belegung löschen?",
      message: `Das Mietverhältnis${who} (ab ${formatMonth(row.occupancy.from)}) wird mit allen Zahlungen, Vorauszahlungen, Kautionsbuchungen, Mieterhöhungen, Übergabeprotokollen und Dokumenten unwiderruflich gelöscht.`,
      confirmLabel: "Löschen",
      danger: true,
    });
    if (!ok) return;
    try {
      await cascadeDeleteOccupancy(id);
      toast.success("Belegung gelöscht.");
    } catch (err) {
      toast.error("Löschen fehlgeschlagen.");
      console.error(err);
    }
  };

  const columns: Column<OccupancyRow>[] = [
    {
      key: "tenant",
      header: "Mieter",
      render: (r) => r.tenant?.name ?? "–",
    },
    {
      key: "from",
      header: "Von",
      render: (r) => formatMonth(r.occupancy.from),
      sortValue: (r) => r.occupancy.from,
    },
    {
      key: "to",
      header: "Bis",
      render: (r) =>
        r.occupancy.to ? (
          formatMonth(r.occupancy.to)
        ) : (
          <StatusBadge status="green" label="Aktuell" />
        ),
    },
    {
      key: "persons",
      header: "Personen",
      render: (r) => r.occupancy.persons,
      align: "center",
    },
    {
      key: "rent",
      header: "Miete (kalt + NK)",
      render: (r) => (
        <span className="font-mono font-tabular">
          {formatEuro(r.occupancy.rentCold)} + {formatEuro(r.occupancy.rentUtilities)}
        </span>
      ),
      align: "right",
    },
    {
      key: "deposit",
      header: "Kaution",
      render: (r) => (
        <span className="font-mono font-tabular">
          {formatEuro(r.occupancy.deposit)}
          {r.occupancy.depositPaid ? (
            <StatusBadge status="green" label="Bezahlt" />
          ) : (
            <StatusBadge status="red" label="Offen" />
          )}
        </span>
      ),
      align: "right",
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex gap-1">
          {r.tenant && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                const tenant = r.tenant;
                if (tenant) setContractOcc({ occupancy: r.occupancy, tenant });
              }}
            >
              Vertrag
            </Button>
          )}
          <Button
            variant="dangerGhost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              void handleDeleteOccupancy(r);
            }}
          >
            Löschen
          </Button>
        </div>
      ),
    },
  ];

  if (contractOcc) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setContractOcc(null)}>
          ← Zurück zur Wohnung
        </Button>
        <ContractTemplate
          occupancy={contractOcc.occupancy}
          unit={unit}
          tenant={contractOcc.tenant}
        />
      </div>
    );
  }

  const tErr = tenantValidation.errors;
  const oErr = occValidation.errors;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        ← Zurück zur Übersicht
      </Button>

      <h2 className="text-lg font-bold text-fg">
        Wohnung: {unit.name}
        {unit.floor && <span className="text-fg-muted font-normal"> ({unit.floor})</span>}
      </h2>

      {/* Mieter-Verwaltung */}
      <Card
        title="Mieter"
        action={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() => setShowTenantForm(true)}
          >
            Mieter
          </Button>
        }
      >
        {showTenantForm && (
          <form
            className="mb-4 p-4 bg-surface-muted rounded-lg border border-border"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSaveTenant();
            }}
            noValidate
          >
            <h3 className="text-sm font-semibold text-fg mb-3">Neuer Mieter</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Name" required error={tErr.name}>
                <Input
                  value={tenantForm.name}
                  onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })}
                  autoComplete="name"
                />
              </FormField>
              <FormField label="E-Mail" error={tErr.email}>
                <Input
                  type="email"
                  value={tenantForm.email}
                  onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })}
                  autoComplete="email"
                />
              </FormField>
              <FormField label="Telefon">
                <Input
                  type="tel"
                  value={tenantForm.phone}
                  onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })}
                  autoComplete="tel"
                />
              </FormField>
              <FormField label="Notizen">
                <Input
                  value={tenantForm.notes}
                  onChange={(e) => setTenantForm({ ...tenantForm, notes: e.target.value })}
                />
              </FormField>
            </div>
            <div className="flex gap-2 mt-1">
              <Button type="submit" variant="primary" size="sm">
                Speichern
              </Button>
              <Button variant="outline" size="sm" onClick={closeTenantForm}>
                Abbrechen
              </Button>
            </div>
          </form>
        )}

        {tenants === undefined ? (
          <div className="space-y-2">
            <Skeleton height="2.5rem" />
            <Skeleton height="2.5rem" />
          </div>
        ) : tenants.length > 0 ? (
          <ul className="divide-y divide-border">
            {tenants.map((t) => (
              <li key={t.id} className="py-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-fg">{t.name}</p>
                  <p className="text-xs text-fg-muted">
                    {[t.email, t.phone].filter(Boolean).join(" | ") || "Keine Kontaktdaten"}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setOccForm((f) => ({ ...f, tenantId: t.id != null ? String(t.id) : "" }));
                    setShowOccForm(true);
                  }}
                >
                  Belegung anlegen
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-fg-muted">Noch keine Mieter angelegt.</p>
        )}
      </Card>

      {/* Belegung anlegen */}
      {showOccForm && (
        <Card title="Neue Belegung">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSaveOccupancy();
            }}
            noValidate
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Mieter" required error={oErr.tenantId}>
                <Select
                  value={occForm.tenantId}
                  onChange={(e) => setOccForm({ ...occForm, tenantId: e.target.value })}
                >
                  <option value="">Bitte wählen</option>
                  {tenants?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Personen" required error={oErr.persons}>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={occForm.persons}
                  onChange={(e) => setOccForm({ ...occForm, persons: e.target.value })}
                />
              </FormField>
              <FormField label="Einzug (Monat)" required error={oErr.from}>
                <Input
                  type="month"
                  value={occForm.from}
                  onChange={(e) => setOccForm({ ...occForm, from: e.target.value })}
                />
              </FormField>
              <FormField label="Auszug (Monat)" hint="leer = aktuell" error={oErr.to}>
                <Input
                  type="month"
                  value={occForm.to}
                  min={occForm.from || undefined}
                  onChange={(e) => setOccForm({ ...occForm, to: e.target.value })}
                />
              </FormField>
              <FormField label="Kaltmiete">
                <NumInput
                  value={occForm.rentCold}
                  onChange={(rentCold) => setOccForm({ ...occForm, rentCold })}
                  suffix="€"
                  min={0}
                />
              </FormField>
              <FormField label="NK-Vorauszahlung">
                <NumInput
                  value={occForm.rentUtilities}
                  onChange={(rentUtilities) => setOccForm({ ...occForm, rentUtilities })}
                  suffix="€"
                  min={0}
                />
              </FormField>
              <FormField label="Kaution">
                <NumInput
                  value={occForm.deposit}
                  onChange={(deposit) => setOccForm({ ...occForm, deposit })}
                  suffix="€"
                  min={0}
                />
              </FormField>
              <div className="flex items-center pb-4">
                <Checkbox
                  label="Kaution bezahlt"
                  checked={occForm.depositPaid}
                  onChange={(e) => setOccForm({ ...occForm, depositPaid: e.target.checked })}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <Button type="submit" variant="primary" size="sm">
                Belegung speichern
              </Button>
              <Button variant="outline" size="sm" onClick={closeOccForm}>
                Abbrechen
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Belegungshistorie */}
      <Card title="Belegungshistorie">
        {rows === undefined ? (
          <div className="space-y-2">
            <Skeleton height="2rem" />
            <Skeleton height="2rem" />
          </div>
        ) : rows.length > 0 ? (
          <DataTable
            columns={columns}
            data={rows}
            keyFn={(r) => r.occupancy.id ?? `${r.occupancy.tenantId}-${r.occupancy.from}`}
          />
        ) : (
          <p className="text-sm text-fg-muted">Noch keine Belegungen vorhanden.</p>
        )}
      </Card>
      {/* Miethistorie & Kaution für aktuelle Belegung */}
      {rows &&
        rows.length > 0 &&
        (() => {
          const now = currentMonth();
          const current = rows.find(
            (r) => r.occupancy.from <= now && (r.occupancy.to === null || r.occupancy.to >= now),
          );
          if (!current) return null;
          return (
            <>
              <RentHistory occupancy={current.occupancy} unit={unit} />
              <DepositManager occupancy={current.occupancy} />
            </>
          );
        })()}

      {/* Dokumente */}
      {unit.id != null && (
        <DocumentStore entityType="unit" entityId={unit.id} title="Dokumente zur Wohnung" />
      )}
    </div>
  );
}
