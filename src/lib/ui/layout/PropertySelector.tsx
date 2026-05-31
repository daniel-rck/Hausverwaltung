import { useState } from "react";
import { useProperty } from "../../hooks/useProperty";
import { Button } from "../ui/Button";
import { FormField } from "../ui/FormField";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { required, useFormValidation } from "../ui/useFormValidation";

export function PropertySelector() {
  const { properties, activeProperty, setActivePropertyId, addProperty } = useProperty();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      {properties.length > 0 && (
        <label className="sr-only" htmlFor="property-select">
          Aktives Objekt
        </label>
      )}
      {properties.length > 0 && (
        <select
          id="property-select"
          value={activeProperty?.id ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__new__") {
              setOpen(true);
              return;
            }
            setActivePropertyId(Number(v));
          }}
          className="h-9 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg pl-3 pr-3 bg-white dark:bg-zinc-700 text-zinc-700 dark:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 max-w-[180px]"
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="__new__">+ Neues Objekt…</option>
        </select>
      )}

      {properties.length === 0 && (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          + Objekt
        </Button>
      )}

      <AddPropertyModal
        open={open}
        onClose={() => setOpen(false)}
        onCreate={async (data) => {
          const id = await addProperty(data);
          setActivePropertyId(id);
        }}
      />
    </div>
  );
}

interface AddPropertyModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; address: string; units: number }) => Promise<void>;
}

function AddPropertyModal({ open, onClose, onCreate }: AddPropertyModalProps) {
  const [form, setForm] = useState({ name: "", address: "", units: 1 });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { errors, validate, validateField } = useFormValidation<typeof form>({
    name: required("Bitte Name angeben"),
  });

  const reset = () => {
    setForm({ name: "", address: "", units: 1 });
  };

  const handleClose = () => {
    onClose();
    setTimeout(reset, 200);
  };

  const handleCreate = async () => {
    if (!validate(form)) return;
    setBusy(true);
    try {
      await onCreate({
        name: form.name.trim(),
        address: form.address.trim(),
        units: Math.max(0, Number(form.units) || 0),
      });
      toast.success(`Objekt „${form.name.trim()}“ angelegt.`);
      handleClose();
    } catch (err) {
      toast.error("Anlegen fehlgeschlagen.");
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Neues Objekt anlegen"
      description="Lege Name und Adresse fest. Wohneinheiten kannst du später ergänzen."
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={busy}>
            Abbrechen
          </Button>
          <Button variant="primary" onClick={handleCreate} loading={busy}>
            Anlegen
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormField label="Name" required error={errors.name}>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            onBlur={() => validateField("name", form)}
            placeholder="z.B. Hauptstr. 12"
            autoFocus
          />
        </FormField>
        <FormField label="Adresse">
          <Input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Straße, PLZ, Ort"
          />
        </FormField>
        <FormField label="Anzahl Wohneinheiten" hint="optional">
          <Input
            type="number"
            min={0}
            value={form.units}
            onChange={(e) => setForm({ ...form, units: Number(e.target.value) })}
          />
        </FormField>
      </div>
    </Modal>
  );
}
