import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

type TableName = keyof typeof db & string;

/**
 * Generic CRUD hook for any Dexie store.
 * Usage: const { items, add, update, remove } = useDB('units', { propertyId });
 */
export function useDB<T extends { id?: number }>(
  table: TableName,
  filter?: Record<string, unknown>,
) {
  const items = useLiveQuery(async () => {
    const tbl = db.table(table);
    if (filter) {
      const [key, value] = Object.entries(filter)[0];
      return tbl.where(key).equals(value as string | number).toArray();
    }
    return tbl.toArray();
  }, [table, filter ? JSON.stringify(filter) : '']) as T[] | undefined;

  const add = useCallback(
    async (item: Omit<T, 'id'>) => {
      return db.table(table).add(item);
    },
    [table],
  );

  const update = useCallback(
    async (item: T) => {
      return db.table(table).put(item);
    },
    [table],
  );

  const remove = useCallback(
    async (id: number) => {
      return db.table(table).delete(id);
    },
    [table],
  );

  return {
    items: items ?? [],
    add,
    update,
    remove,
  };
}
