import * as fc from 'fast-check';

import type { ISyncState } from './ports';
import { raisedSyncState } from './sync-state-ratchet';

const PROPERTY_SEED = 20261013;

const counter = fc.nat({ max: 20 });

const syncState: fc.Arbitrary<ISyncState> = fc.record({
  maxSeenRevision: counter,
  maxSeenKeyslotsEpoch: counter,
  cloudKeyslotsEpoch: counter,
  retiredKeyIds: fc.uniqueArray(fc.constantFrom('k1', 'k2', 'k3', 'k4'), { maxLength: 4 }),
  hashAtMaxSeen: fc.option(fc.constantFrom('h1', 'h2', 'h3')),
  keyId: fc.constantFrom('ff00', 'ee11'),
  lastSyncedRev: fc.option(fc.constantFrom('12', '13')),
  lastHlc: fc.option(fc.record({ wallMs: counter, counter, node: fc.constantFrom('n1', 'n2') })),
});

function bar(state: ISyncState) {
  return {
    maxSeenRevision: state.maxSeenRevision,
    maxSeenKeyslotsEpoch: state.maxSeenKeyslotsEpoch,
    cloudKeyslotsEpoch: state.cloudKeyslotsEpoch,
    retiredKeyIds: new Set(state.retiredKeyIds),
  };
}

describe('sync state ratchet', () => {
  it('never lowers a revision, an epoch or a retired key, whoever saves last', () => {
    fc.assert(
      fc.property(syncState, syncState, (stored, next) => {
        const raised = raisedSyncState(stored, next);
        return [stored, next].every(
          seen =>
            raised.maxSeenRevision >= seen.maxSeenRevision &&
            raised.maxSeenKeyslotsEpoch >= seen.maxSeenKeyslotsEpoch &&
            raised.cloudKeyslotsEpoch >= seen.cloudKeyslotsEpoch &&
            seen.retiredKeyIds.every(keyId => raised.retiredKeyIds.includes(keyId))
        );
      }),
      { seed: PROPERTY_SEED }
    );
  });

  it('reaches the same bar whatever order the saves land in', () => {
    fc.assert(
      fc.property(syncState, syncState, syncState, (first, second, third) => {
        const forward = raisedSyncState(raisedSyncState(first, second), third);
        const backward = raisedSyncState(raisedSyncState(third, second), first);
        expect(bar(forward)).toEqual(bar(backward));
      }),
      { seed: PROPERTY_SEED }
    );
  });

  it('changes nothing when the same state is saved again', () => {
    fc.assert(
      fc.property(syncState, state => {
        expect(raisedSyncState(state, state)).toEqual(state);
      }),
      { seed: PROPERTY_SEED }
    );
  });

  it('keeps the hash of the file at the highest revision seen', () => {
    fc.assert(
      fc.property(syncState, syncState, (stored, next) => {
        const raised = raisedSyncState(stored, next);
        const owner = next.maxSeenRevision >= stored.maxSeenRevision ? next : stored;
        return raised.hashAtMaxSeen === owner.hashAtMaxSeen;
      }),
      { seed: PROPERTY_SEED }
    );
  });

  it('takes the key, the sync position and the clock from the newer save', () => {
    fc.assert(
      fc.property(syncState, syncState, (stored, next) => {
        const raised = raisedSyncState(stored, next);
        expect([raised.keyId, raised.lastSyncedRev, raised.lastHlc]).toEqual([
          next.keyId,
          next.lastSyncedRev,
          next.lastHlc,
        ]);
      }),
      { seed: PROPERTY_SEED }
    );
  });
});
