import { describe, expect, it } from 'vitest';
import { mergeSnapshots, snapshotSignature } from './merge';
import type { SyncSnapshot } from './snapshot';

function snap(
  tables: SyncSnapshot['tables'],
  tombstones: SyncSnapshot['tombstones'] = [],
): SyncSnapshot {
  return {
    version: 1,
    app: 'hausverwaltung',
    exportedAt: 0,
    tables,
    tombstones,
  };
}

describe('mergeSnapshots — LWW per syncId', () => {
  it('keeps the row with the higher updatedAt', () => {
    const local = snap({
      properties: [{ syncId: 'p1', name: 'Old Name', updatedAt: 1000 }],
    });
    const remote = snap({
      properties: [{ syncId: 'p1', name: 'New Name', updatedAt: 2000 }],
    });
    const merged = mergeSnapshots(local, remote);
    expect(merged.tables.properties).toHaveLength(1);
    expect(merged.tables.properties[0]).toMatchObject({
      syncId: 'p1',
      name: 'New Name',
      updatedAt: 2000,
    });
  });

  it('local wins when local is newer', () => {
    const local = snap({
      units: [{ syncId: 'u1', area: 80, updatedAt: 5000 }],
    });
    const remote = snap({
      units: [{ syncId: 'u1', area: 50, updatedAt: 4000 }],
    });
    const merged = mergeSnapshots(local, remote);
    expect(merged.tables.units[0]).toMatchObject({ area: 80 });
  });

  it('keeps records that exist only on one side', () => {
    const local = snap({
      tenants: [{ syncId: 't1', name: 'Alice', updatedAt: 1000 }],
    });
    const remote = snap({
      tenants: [{ syncId: 't2', name: 'Bob', updatedAt: 1000 }],
    });
    const merged = mergeSnapshots(local, remote);
    const ids = (merged.tables.tenants as { syncId: string }[])
      .map((r) => r.syncId)
      .sort();
    expect(ids).toEqual(['t1', 't2']);
  });

  it('merges multiple tables independently', () => {
    const local = snap({
      properties: [{ syncId: 'p1', updatedAt: 1 }],
      units: [{ syncId: 'u1', updatedAt: 1 }],
    });
    const remote = snap({
      tenants: [{ syncId: 't1', updatedAt: 1 }],
    });
    const merged = mergeSnapshots(local, remote);
    expect(merged.tables.properties).toHaveLength(1);
    expect(merged.tables.units).toHaveLength(1);
    expect(merged.tables.tenants).toHaveLength(1);
  });
});

describe('mergeSnapshots — tombstones', () => {
  it('drops a record when a newer tombstone exists (deletedAt >= updatedAt)', () => {
    const local = snap(
      { properties: [{ syncId: 'p1', name: 'Doomed', updatedAt: 1000 }] },
      [],
    );
    const remote = snap({}, [
      { syncId: 'p1', tableName: 'properties', deletedAt: 2000 },
    ]);
    const merged = mergeSnapshots(local, remote);
    expect(merged.tables.properties ?? []).toHaveLength(0);
    expect(merged.tombstones).toHaveLength(1);
  });

  it('keeps a record when its updatedAt is newer than the tombstone (resurrection)', () => {
    const local = snap({
      properties: [{ syncId: 'p1', name: 'Resurrected', updatedAt: 3000 }],
    });
    const remote = snap({}, [
      { syncId: 'p1', tableName: 'properties', deletedAt: 2000 },
    ]);
    const merged = mergeSnapshots(local, remote);
    expect(merged.tables.properties).toHaveLength(1);
    expect(merged.tables.properties[0]).toMatchObject({ name: 'Resurrected' });
  });

  it('drops a record on tie (deletedAt === updatedAt) — tombstone wins', () => {
    const local = snap({
      properties: [{ syncId: 'p1', updatedAt: 1500 }],
    });
    const remote = snap({}, [
      { syncId: 'p1', tableName: 'properties', deletedAt: 1500 },
    ]);
    const merged = mergeSnapshots(local, remote);
    expect(merged.tables.properties ?? []).toHaveLength(0);
  });

  it('merges tombstones by max(deletedAt)', () => {
    const local = snap({}, [
      { syncId: 'x', tableName: 'units', deletedAt: 1000 },
    ]);
    const remote = snap({}, [
      { syncId: 'x', tableName: 'units', deletedAt: 5000 },
    ]);
    const merged = mergeSnapshots(local, remote);
    expect(merged.tombstones).toHaveLength(1);
    expect(merged.tombstones[0].deletedAt).toBe(5000);
  });

  it('is idempotent — merging the same snapshots twice yields the same content', () => {
    const a = snap(
      { properties: [{ syncId: 'p1', name: 'X', updatedAt: 1 }] },
      [{ syncId: 'p2', tableName: 'properties', deletedAt: 2 }],
    );
    const b = snap({
      properties: [{ syncId: 'p3', name: 'Y', updatedAt: 1 }],
    });
    const m1 = mergeSnapshots(a, b);
    const m2 = mergeSnapshots(m1, b);
    expect(snapshotSignature(m1)).toBe(snapshotSignature(m2));
  });
});

describe('snapshotSignature', () => {
  it('returns the same string for snapshots with the same row count + max(updatedAt)', () => {
    const a = snap({
      properties: [
        { syncId: 'p1', updatedAt: 100 },
        { syncId: 'p2', updatedAt: 200 },
      ],
    });
    const b = snap({
      properties: [
        { syncId: 'p3', updatedAt: 100 },
        { syncId: 'p4', updatedAt: 200 },
      ],
    });
    expect(snapshotSignature(a)).toBe(snapshotSignature(b));
  });

  it('differs when the row count changes', () => {
    const a = snap({ properties: [{ syncId: 'p1', updatedAt: 1 }] });
    const b = snap({
      properties: [
        { syncId: 'p1', updatedAt: 1 },
        { syncId: 'p2', updatedAt: 1 },
      ],
    });
    expect(snapshotSignature(a)).not.toBe(snapshotSignature(b));
  });

  it('differs when max(updatedAt) changes', () => {
    const a = snap({ properties: [{ syncId: 'p1', updatedAt: 100 }] });
    const b = snap({ properties: [{ syncId: 'p1', updatedAt: 200 }] });
    expect(snapshotSignature(a)).not.toBe(snapshotSignature(b));
  });
});
