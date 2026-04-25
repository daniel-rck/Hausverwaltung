/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { cascadeDeleteProperty } from '../db/cascade';
import type { Property } from '../db/schema';

interface PropertyContextValue {
  properties: Property[];
  activeProperty: Property | null;
  setActivePropertyId: (id: number) => void;
  addProperty: (p: Omit<Property, 'id'>) => Promise<number>;
  updateProperty: (p: Property) => Promise<void>;
  deleteProperty: (id: number) => Promise<void>;
}

const PropertyContext = createContext<PropertyContextValue | null>(null);

const EMPTY_PROPERTIES: Property[] = [];

export function PropertyProvider({ children }: { children: ReactNode }) {
  const properties = useLiveQuery(() => db.properties.toArray()) ?? EMPTY_PROPERTIES;
  const [activeId, setActiveId] = useState<number | null>(null);

  // Auto-select first property via useMemo to avoid setState in effect
  const resolvedActiveId = useMemo(() => {
    if (activeId !== null && properties.some((p) => p.id === activeId)) {
      return activeId;
    }
    return properties.length > 0 ? properties[0].id! : null;
  }, [activeId, properties]);

  const activeProperty = properties.find((p) => p.id === resolvedActiveId) ?? null;

  const addProperty = useCallback(async (p: Omit<Property, 'id'>) => {
    const id = await db.properties.add(p as Property);
    setActiveId(id as number);
    return id as number;
  }, []);

  const updateProperty = useCallback(async (p: Property) => {
    await db.properties.put(p);
  }, []);

  const deleteProperty = useCallback(
    async (id: number) => {
      await cascadeDeleteProperty(id);
      if (activeId === id) {
        setActiveId(null);
      }
    },
    [activeId],
  );

  return (
    <PropertyContext.Provider
      value={{
        properties,
        activeProperty,
        setActivePropertyId: (id: number) => setActiveId(id),
        addProperty,
        updateProperty,
        deleteProperty,
      }}
    >
      {children}
    </PropertyContext.Provider>
  );
}

export function useProperty(): PropertyContextValue {
  const ctx = useContext(PropertyContext);
  if (!ctx) {
    throw new Error('useProperty must be used within PropertyProvider');
  }
  return ctx;
}
