import { guardUnion } from './guard-union';
import type { ISyncGuard } from './sync-state';

const GUARD: ISyncGuard = {
  vaultId: 'v',
  keyId: 'k',
  maxSeenRevision: 5,
  maxSeenKeyslotsEpoch: 1,
  hashAtMaxSeen: 'h5',
  retiredKeyIds: [],
};

describe('guard union', () => {
  it('keeps the highest revision with its hash and the highest key-slot epoch', () => {
    const cloud = { ...GUARD, maxSeenRevision: 7, hashAtMaxSeen: 'h7', maxSeenKeyslotsEpoch: 0 };

    expect(guardUnion(GUARD, cloud)).toEqual({
      ...GUARD,
      maxSeenRevision: 7,
      hashAtMaxSeen: 'h7',
      maxSeenKeyslotsEpoch: 1,
    });
    expect(guardUnion(cloud, GUARD)).toEqual(guardUnion(GUARD, cloud));
  });

  it('keeps a known hash when the other saw the same revision without one', () => {
    expect(guardUnion({ ...GUARD, hashAtMaxSeen: null }, GUARD).hashAtMaxSeen).toBe('h5');
  });
});
