/* eslint-disable react-refresh/only-export-components */
import { Card } from "../../lib/ui/shared/Card";
import { Button, IconButton, Input } from "../../lib/ui/ui";
import { Plus, X } from "../../lib/ui/ui/icons";

type KeyEntry = {
  type: string;
  count: number;
};

type KeyHandoverProps = {
  keys: KeyEntry[];
  onChange: (keys: KeyEntry[]) => void;
};

const DEFAULT_KEY_TYPES = ["Haustür", "Wohnungstür", "Briefkasten", "Keller"];

export function createDefaultKeys(): KeyEntry[] {
  return DEFAULT_KEY_TYPES.map((type) => ({ type, count: 0 }));
}

export function KeyHandover({ keys, onChange }: KeyHandoverProps) {
  const updateKey = (index: number, updates: Partial<KeyEntry>) => {
    const updated = keys.map((key, i) => (i === index ? { ...key, ...updates } : key));
    onChange(updated);
  };

  const removeKey = (index: number) => {
    onChange(keys.filter((_, i) => i !== index));
  };

  const addKey = () => {
    onChange([...keys, { type: "", count: 0 }]);
  };

  return (
    <Card title="Schlüsselübergabe">
      <div className="space-y-2">
        {/* Header */}
        <div
          aria-hidden="true"
          className="grid grid-cols-[1fr_80px_40px] gap-2 text-xs font-medium text-fg-muted px-1"
        >
          <span>Schlüsselart</span>
          <span className="text-center">Anzahl</span>
          <span />
        </div>

        {/* Rows */}
        {keys.map((key, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: editierbare Positionsliste ohne stabile ID (stabile IDs folgen mit dem Schema-Umbau in Phase 4)
          <div key={index} className="grid grid-cols-[1fr_80px_40px] gap-2 items-center">
            <Input
              value={key.type}
              onChange={(e) => updateKey(index, { type: e.target.value })}
              placeholder="z. B. Garage"
              aria-label={`Schlüsselart ${index + 1}`}
            />
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={key.count || ""}
              onChange={(e) => updateKey(index, { count: parseInt(e.target.value, 10) || 0 })}
              aria-label={`Anzahl ${key.type || `Schlüssel ${index + 1}`}`}
              className="text-center font-mono"
            />
            <IconButton
              aria-label="Schlüssel entfernen"
              title="Schlüssel entfernen"
              size="sm"
              icon={<X size={16} />}
              onClick={() => removeKey(index)}
            />
          </div>
        ))}

        {/* Add button */}
        <Button
          variant="outline"
          fullWidth
          leftIcon={<Plus size={14} />}
          onClick={addKey}
          className="border-dashed"
        >
          Weiteren Schlüssel hinzufügen
        </Button>
      </div>
    </Card>
  );
}
