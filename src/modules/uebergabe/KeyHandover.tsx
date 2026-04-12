/* eslint-disable react-refresh/only-export-components */
import { Card } from '../../components/shared/Card';

interface KeyEntry {
  type: string;
  count: number;
}

interface KeyHandoverProps {
  keys: KeyEntry[];
  onChange: (keys: KeyEntry[]) => void;
}

const DEFAULT_KEY_TYPES = ['Haustür', 'Wohnungstür', 'Briefkasten', 'Keller'];

export function createDefaultKeys(): KeyEntry[] {
  return DEFAULT_KEY_TYPES.map((type) => ({ type, count: 0 }));
}

export function KeyHandover({ keys, onChange }: KeyHandoverProps) {
  const updateKey = (index: number, updates: Partial<KeyEntry>) => {
    const updated = keys.map((key, i) =>
      i === index ? { ...key, ...updates } : key,
    );
    onChange(updated);
  };

  const removeKey = (index: number) => {
    onChange(keys.filter((_, i) => i !== index));
  };

  const addKey = () => {
    onChange([...keys, { type: '', count: 0 }]);
  };

  return (
    <Card title="Schlüsselübergabe">
      <div className="space-y-2">
        {/* Header */}
        <div className="grid grid-cols-[1fr_80px_40px] gap-2 text-xs font-medium text-stone-500 px-1">
          <span>Schlüsselart</span>
          <span className="text-center">Anzahl</span>
          <span />
        </div>

        {/* Rows */}
        {keys.map((key, index) => (
          <div
            key={index}
            className="grid grid-cols-[1fr_80px_40px] gap-2 items-center"
          >
            <input
              type="text"
              value={key.type}
              onChange={(e) => updateKey(index, { type: e.target.value })}
              placeholder="Schlüsselart"
              className="border border-stone-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
            />
            <input
              type="number"
              min="0"
              value={key.count || ''}
              onChange={(e) =>
                updateKey(index, { count: parseInt(e.target.value) || 0 })
              }
              className="border border-stone-300 rounded-lg px-3 py-1.5 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-stone-400"
            />
            <button
              type="button"
              onClick={() => removeKey(index)}
              className="text-red-400 hover:text-red-600 text-lg leading-none"
              title="Entfernen"
            >
              &times;
            </button>
          </div>
        ))}

        {/* Add button */}
        <button
          type="button"
          onClick={addKey}
          className="text-sm text-stone-600 hover:text-stone-800 px-3 py-1.5 border border-dashed border-stone-300 rounded-lg hover:bg-stone-50 transition-colors w-full"
        >
          + Weiteren Schlüssel hinzufügen
        </button>
      </div>
    </Card>
  );
}
