/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import type { Rating, RoomCondition } from "../../lib/db/schema";
import { Card } from "../../lib/ui/shared/Card";
import { Button, FormField, Input, Select, useConfirm, useToast } from "../../lib/ui/ui";
import { Plus } from "../../lib/ui/ui/icons";

type RoomInspectionProps = {
  rooms: RoomCondition[];
  onChange: (rooms: RoomCondition[]) => void;
};

const DEFAULT_ROOMS = ["Flur", "Wohnzimmer", "Schlafzimmer", "Küche", "Bad", "Balkon/Terrasse"];

const RATING_OPTIONS: { value: Rating; label: string }[] = [
  { value: "good", label: "Gut" },
  { value: "fair", label: "Mittel" },
  { value: "poor", label: "Schlecht" },
];

const ASPECTS = [
  { key: "walls" as const, label: "Wände" },
  { key: "floor" as const, label: "Boden" },
  { key: "ceiling" as const, label: "Decke" },
  { key: "windows" as const, label: "Fenster" },
  { key: "doors" as const, label: "Türen" },
];

/** Status-Punkt neben dem Label; die Bewertung selbst steht als Text im Select. */
function ratingDot(rating: Rating): string {
  switch (rating) {
    case "good":
      return "bg-success";
    case "fair":
      return "bg-warning";
    case "poor":
      return "bg-danger";
  }
}

function createDefaultRoom(name: string): RoomCondition {
  return {
    name,
    walls: "good",
    floor: "good",
    ceiling: "good",
    windows: "good",
    doors: "good",
    notes: "",
  };
}

export function createDefaultRooms(): RoomCondition[] {
  return DEFAULT_ROOMS.map(createDefaultRoom);
}

export function RoomInspection({ rooms, onChange }: RoomInspectionProps) {
  const [newRoomName, setNewRoomName] = useState("");
  const confirm = useConfirm();
  const toast = useToast();

  const updateRoom = (index: number, updates: Partial<RoomCondition>) => {
    const updated = rooms.map((room, i) => (i === index ? { ...room, ...updates } : room));
    onChange(updated);
  };

  const removeRoom = async (index: number) => {
    const room = rooms[index];
    if (!room) return;
    const ok = await confirm({
      title: "Raum entfernen?",
      message: `„${room.name}“ wird samt Bewertungen und Bemerkungen aus dem Protokoll entfernt.`,
      confirmLabel: "Entfernen",
      danger: true,
    });
    if (!ok) return;
    onChange(rooms.filter((_, i) => i !== index));
    toast.success(`Raum „${room.name}“ entfernt.`);
  };

  const addRoom = () => {
    const name = newRoomName.trim();
    if (!name) return;
    onChange([...rooms, createDefaultRoom(name)]);
    setNewRoomName("");
  };

  return (
    <div className="space-y-4">
      {rooms.map((room, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: editierbare Positionsliste ohne stabile ID (stabile IDs folgen mit dem Schema-Umbau in Phase 4)
        <Card key={index}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-fg">{room.name}</h3>
            <Button variant="dangerGhost" size="sm" onClick={() => void removeRoom(index)}>
              Entfernen
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
            {ASPECTS.map((aspect) => (
              <FormField
                key={aspect.key}
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className={`inline-block h-2 w-2 rounded-full ${ratingDot(room[aspect.key])}`}
                    />
                    {aspect.label}
                  </span>
                }
              >
                <Select
                  value={room[aspect.key]}
                  onChange={(e) =>
                    updateRoom(index, {
                      [aspect.key]: e.target.value as Rating,
                    })
                  }
                  className="font-medium"
                >
                  {RATING_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </FormField>
            ))}
          </div>

          <FormField label="Bemerkungen">
            <Input
              value={room.notes ?? ""}
              onChange={(e) => updateRoom(index, { notes: e.target.value })}
              placeholder="z. B. Kratzer an der Tür"
            />
          </FormField>
        </Card>
      ))}

      <div className="flex gap-2 items-start">
        <div className="flex-1">
          <FormField label="Weiteren Raum hinzufügen">
            <Input
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addRoom();
                }
              }}
              placeholder="z. B. Abstellraum"
            />
          </FormField>
        </div>
        <Button
          variant="primary"
          leftIcon={<Plus size={14} />}
          onClick={addRoom}
          disabled={!newRoomName.trim()}
          className="mt-5"
        >
          Raum
        </Button>
      </div>
    </div>
  );
}
