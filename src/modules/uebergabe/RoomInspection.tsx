/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react';
import { Card } from '../../components/shared/Card';
import type { RoomCondition, Rating } from '../../db/schema';

interface RoomInspectionProps {
  rooms: RoomCondition[];
  onChange: (rooms: RoomCondition[]) => void;
}

const DEFAULT_ROOMS = [
  'Flur',
  'Wohnzimmer',
  'Schlafzimmer',
  'Küche',
  'Bad',
  'Balkon/Terrasse',
];

const RATING_OPTIONS: { value: Rating; label: string }[] = [
  { value: 'good', label: 'Gut' },
  { value: 'fair', label: 'Mittel' },
  { value: 'poor', label: 'Schlecht' },
];

const ASPECTS = [
  { key: 'walls' as const, label: 'Wände' },
  { key: 'floor' as const, label: 'Boden' },
  { key: 'ceiling' as const, label: 'Decke' },
  { key: 'windows' as const, label: 'Fenster' },
  { key: 'doors' as const, label: 'Türen' },
];

function ratingColor(rating: Rating): string {
  switch (rating) {
    case 'good':
      return 'bg-green-100 text-green-700 border-green-300';
    case 'fair':
      return 'bg-amber-100 text-amber-700 border-amber-300';
    case 'poor':
      return 'bg-red-100 text-red-700 border-red-300';
  }
}

function createDefaultRoom(name: string): RoomCondition {
  return {
    name,
    walls: 'good',
    floor: 'good',
    ceiling: 'good',
    windows: 'good',
    doors: 'good',
    notes: '',
  };
}

export function createDefaultRooms(): RoomCondition[] {
  return DEFAULT_ROOMS.map(createDefaultRoom);
}

export function RoomInspection({ rooms, onChange }: RoomInspectionProps) {
  const [newRoomName, setNewRoomName] = useState('');

  const updateRoom = (index: number, updates: Partial<RoomCondition>) => {
    const updated = rooms.map((room, i) =>
      i === index ? { ...room, ...updates } : room,
    );
    onChange(updated);
  };

  const removeRoom = (index: number) => {
    onChange(rooms.filter((_, i) => i !== index));
  };

  const addRoom = () => {
    const name = newRoomName.trim();
    if (!name) return;
    onChange([...rooms, createDefaultRoom(name)]);
    setNewRoomName('');
  };

  return (
    <div className="space-y-4">
      {rooms.map((room, index) => (
        <Card key={index}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-stone-800">{room.name}</h3>
            <button
              type="button"
              onClick={() => removeRoom(index)}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Entfernen
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
            {ASPECTS.map((aspect) => (
              <div key={aspect.key}>
                <label className="block text-xs font-medium text-stone-500 mb-1">
                  {aspect.label}
                </label>
                <select
                  value={room[aspect.key]}
                  onChange={(e) =>
                    updateRoom(index, {
                      [aspect.key]: e.target.value as Rating,
                    })
                  }
                  className={`w-full border rounded-lg px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-stone-400 ${ratingColor(room[aspect.key])}`}
                >
                  {RATING_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">
              Bemerkungen
            </label>
            <input
              type="text"
              value={room.notes ?? ''}
              onChange={(e) => updateRoom(index, { notes: e.target.value })}
              placeholder="z.B. Kratzer an der Tür"
              className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
            />
          </div>
        </Card>
      ))}

      <div className="flex gap-2">
        <input
          type="text"
          value={newRoomName}
          onChange={(e) => setNewRoomName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addRoom();
            }
          }}
          placeholder="Weiteren Raum hinzufügen..."
          className="flex-1 border border-stone-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
        <button
          type="button"
          onClick={addRoom}
          disabled={!newRoomName.trim()}
          className="px-4 py-1.5 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Raum
        </button>
      </div>
    </div>
  );
}
