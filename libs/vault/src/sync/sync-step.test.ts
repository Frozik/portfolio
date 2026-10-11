import type { IStorageObjectStat, TStorageRev } from '@frozik/cloud-storage/core/storage-provider';
import type { Milliseconds } from '@frozik/utils/date/types';

import type { IVaultKeys } from '../format/vault-keys';
import { emptyVaultDocument } from '../model/vault-document';
import type { TSyncEffect } from './sync-effects';
import type { IOpenedHeader, TSyncEvent } from './sync-events';
import type { ISyncState } from './sync-state';
import { initialSyncState } from './sync-state';
import { MAX_IMMEDIATE_CONFLICTS, syncStep } from './sync-step';

const guard = {
  vaultId: 'vault-a',
  keyId: 'key-1',
  maxSeenRevision: 4,
  maxSeenKeyslotsEpoch: 1,
  hashAtMaxSeen: 'hash-4',
  retiredKeyIds: [],
};
const rev = (value: string): TStorageRev => value as TStorageRev;
const stat = (value: string): IStorageObjectStat => ({
  path: 'v.pwv' as never,
  rev: rev(value),
  size: 10,
  modifiedAt: 0 as Milliseconds,
});
const file = Uint8Array.of(1, 2, 3);
const document = emptyVaultDocument('Remote', { wallMs: 1, counter: 0, node: 'r' });
/** The engine passes the file's keys on untouched; their contents do not matter to it. */
const KEYS = { keyslotsEpoch: 0 } as IVaultKeys;
const header = (overrides: Partial<IOpenedHeader> = {}): IOpenedHeader => ({
  vaultId: 'vault-a',
  keyId: 'key-1',
  revision: 6,
  keyslotsEpoch: 1,
  access: 'read-write',
  movedTo: null,
  fileHash: 'hash-6',
  ...overrides,
});

function run(
  state: ISyncState,
  events: readonly TSyncEvent[]
): { readonly state: ISyncState; readonly effects: readonly TSyncEffect[] } {
  return events.reduce<{ state: ISyncState; effects: readonly TSyncEffect[] }>(
    (current, event) => {
      const next = syncStep(current.state, event);
      return { state: next.state, effects: [...current.effects, ...next.effects] };
    },
    { state, effects: [] }
  );
}

const kinds = (effects: readonly TSyncEffect[]): readonly string[] =>
  effects.map(effect => effect.kind);
const synced = initialSyncState(guard, rev('r5'));

describe('sync engine', () => {
  it('writes over the revision it last synced when nothing changed elsewhere', () => {
    const { state, effects } = run(synced, [
      { kind: 'push-requested' },
      { kind: 'stat-done', result: { ok: true, value: stat('r5') } },
      { kind: 'sealed', file, fileHash: 'sealed-hash', keyslotsEpoch: 0 },
      { kind: 'write-done', result: { ok: true, value: { kind: 'ok', stat: stat('r6') } } },
    ]);

    expect(kinds(effects)).toEqual(['stat', 'seal', 'write', 'save-guard', 'keys-shared']);
    expect(effects[1]).toEqual({ kind: 'seal', revision: 5 });
    expect(effects[2]).toEqual({
      kind: 'write',
      file,
      precondition: { kind: 'match', rev: rev('r5') },
    });
    expect(state.phase).toEqual({ kind: 'idle' });
    expect(state.context.lastSyncedRev).toBe('r6');
    expect(state.context.guard.maxSeenRevision).toBe(5);
  });

  it('reads, opens and merges a newer remote version before writing over it', () => {
    const { state, effects } = run(synced, [
      { kind: 'push-requested' },
      { kind: 'stat-done', result: { ok: true, value: stat('r7') } },
      { kind: 'read-done', result: { ok: true, value: { bytes: file, stat: stat('r7') } } },
      { kind: 'opened', result: { ok: true, value: { header: header(), document, keys: KEYS } } },
      { kind: 'merged', localHasNews: true },
    ]);

    expect(kinds(effects)).toEqual(['stat', 'read', 'open', 'merge', 'save-guard', 'seal']);
    expect(effects.at(-1)).toEqual({ kind: 'seal', revision: 7 });
    expect(state.phase).toMatchObject({
      kind: 'sealing',
      precondition: { kind: 'match', rev: rev('r7') },
    });
  });

  it('only takes the remote in when the merge found nothing of its own to add', () => {
    const { state, effects } = run(synced, [
      { kind: 'pull-requested' },
      { kind: 'stat-done', result: { ok: true, value: stat('r7') } },
      { kind: 'read-done', result: { ok: true, value: { bytes: file, stat: stat('r7') } } },
      { kind: 'opened', result: { ok: true, value: { header: header(), document, keys: KEYS } } },
      { kind: 'merged', localHasNews: false },
    ]);

    expect(kinds(effects)).not.toContain('write');
    expect(state.phase).toEqual({ kind: 'idle' });
    expect(state.context.lastSyncedRev).toBe('r7');
  });

  it('ends a pull at once when the remote is the version it last synced', () => {
    const { state, effects } = run(synced, [
      { kind: 'pull-requested' },
      { kind: 'stat-done', result: { ok: true, value: stat('r5') } },
    ]);

    expect(kinds(effects)).toEqual(['stat']);
    expect(state.phase).toEqual({ kind: 'idle' });
  });

  it('creates the file where there is none yet', () => {
    const { effects } = run(initialSyncState(guard, null), [
      { kind: 'push-requested' },
      { kind: 'stat-done', result: { ok: true, value: null } },
      { kind: 'sealed', file, fileHash: 'sealed-hash', keyslotsEpoch: 0 },
    ]);

    expect(effects.at(-1)).toEqual({ kind: 'write', file, precondition: { kind: 'absent' } });
  });

  it('starts over after a conflict, and waits for a timer after several in a row', () => {
    const conflict: TSyncEvent = {
      kind: 'write-done',
      result: { ok: true, value: { kind: 'conflict', current: stat('r9') } },
    };
    const roundTrip: TSyncEvent[] = [
      { kind: 'stat-done', result: { ok: true, value: stat('r5') } },
      { kind: 'sealed', file, fileHash: 'sealed-hash', keyslotsEpoch: 0 },
      conflict,
    ];
    const events: TSyncEvent[] = [
      { kind: 'push-requested' },
      ...Array.from({ length: MAX_IMMEDIATE_CONFLICTS }, () => roundTrip).flat(),
    ];

    const { state, effects } = run(synced, events);

    expect(effects.filter(effect => effect.kind === 'stat')).toHaveLength(MAX_IMMEDIATE_CONFLICTS);
    expect(effects.at(-1)).toEqual({ kind: 'schedule-retry', attempt: MAX_IMMEDIATE_CONFLICTS });
    expect(state.phase).toEqual({ kind: 'waiting', cause: { kind: 'conflicts' } });
    expect(
      kinds(syncStep(state, { kind: 'retry-due', attempt: MAX_IMMEDIATE_CONFLICTS }).effects)
    ).toEqual(['stat']);
  });

  it('waits offline with the change pending and pushes it when the network is back', () => {
    const offline = run(synced, [
      { kind: 'push-requested' },
      { kind: 'stat-done', result: { ok: false, error: { kind: 'offline' } } },
    ]);

    expect(offline.state.phase).toEqual({ kind: 'waiting', cause: { kind: 'offline' } });
    expect(syncStep(offline.state, { kind: 'online' }).state.phase).toEqual({
      kind: 'statting',
      intent: 'push',
    });
  });

  it('runs one more cycle for changes that came during one, however many there were', () => {
    const busy = run(synced, [
      { kind: 'push-requested' },
      { kind: 'push-requested' },
      { kind: 'push-requested' },
    ]);
    const { state, effects } = run(busy.state, [
      { kind: 'stat-done', result: { ok: true, value: stat('r5') } },
      { kind: 'sealed', file, fileHash: 'sealed-hash', keyslotsEpoch: 0 },
      { kind: 'write-done', result: { ok: true, value: { kind: 'ok', stat: stat('r6') } } },
    ]);

    expect(kinds(effects)).toEqual(['seal', 'write', 'save-guard', 'keys-shared', 'stat']);
    expect(state.phase).toEqual({ kind: 'statting', intent: 'push' });
    expect(state.context.pending).toBe(false);
  });

  it.each([
    ['another vault at the same place', header({ vaultId: 'vault-b' }), { kind: 'foreign-vault' }],
    ['a rotated key', header({ keyId: 'key-2' }), { kind: 'key-rotated' }],
    ['an older set of key slots', header({ keyslotsEpoch: 0 }), { kind: 'rollback-security' }],
    ['a newer document schema', header({ access: 'read-only' }), { kind: 'read-only' }],
    [
      'a vault that moved elsewhere',
      header({ movedTo: 'webdav:https://dav.example/vault.pwv' }),
      { kind: 'moved', to: 'webdav:https://dav.example/vault.pwv' },
    ],
  ] as const)('stops instead of merging %s', (_name, opened, reason) => {
    const { state, effects } = run(synced, [
      { kind: 'push-requested' },
      { kind: 'stat-done', result: { ok: true, value: stat('r7') } },
      { kind: 'read-done', result: { ok: true, value: { bytes: file, stat: stat('r7') } } },
      { kind: 'opened', result: { ok: true, value: { header: opened, document, keys: KEYS } } },
    ]);

    expect(state.phase).toEqual({ kind: 'stopped', reason });
    expect(kinds(effects)).not.toContain('merge');
    expect(syncStep(state, { kind: 'push-requested' }).effects).toEqual([]);
  });

  it('stops for another vault the session key cannot even open, rather than taking it for a rotated key', () => {
    const { state } = run(synced, [
      { kind: 'push-requested' },
      { kind: 'stat-done', result: { ok: true, value: stat('r7') } },
      { kind: 'read-done', result: { ok: true, value: { bytes: file, stat: stat('r7') } } },
      { kind: 'opened', result: { ok: false, error: { kind: 'foreign-vault' } } },
    ]);

    expect(state.phase).toEqual({ kind: 'stopped', reason: { kind: 'foreign-vault' } });
  });

  it('merges a file older than one seen before, and remembers to warn', () => {
    const { state, effects } = run(synced, [
      { kind: 'pull-requested' },
      { kind: 'stat-done', result: { ok: true, value: stat('r3') } },
      { kind: 'read-done', result: { ok: true, value: { bytes: file, stat: stat('r3') } } },
      {
        kind: 'opened',
        result: { ok: true, value: { header: header({ revision: 2 }), document, keys: KEYS } },
      },
    ]);

    expect(kinds(effects)).toContain('merge');
    expect(state.context.rolledBack).toBe(true);
    expect(state.context.guard.maxSeenRevision).toBe(4);
  });

  it('ignores an answer that does not belong to the current phase', () => {
    const late = syncStep(synced, {
      kind: 'write-done',
      result: { ok: true, value: { kind: 'ok', stat: stat('r9') } },
    });

    expect(late).toEqual({ state: synced, effects: [] });
  });

  it('warns about a file with the revision it saw last but other bytes, and merges it', () => {
    const { state, effects } = run(synced, [
      { kind: 'pull-requested' },
      { kind: 'stat-done', result: { ok: true, value: stat('r9') } },
      { kind: 'read-done', result: { ok: true, value: { bytes: file, stat: stat('r9') } } },
      {
        kind: 'opened',
        result: {
          ok: true,
          value: { header: header({ revision: 4, fileHash: 'other-bytes' }), document, keys: KEYS },
        },
      },
    ]);

    expect(kinds(effects)).toContain('merge');
    expect(state.context.rolledBack).toBe(true);
  });

  it('ignores a retry timer from an earlier wait', () => {
    const waiting = run(synced, [
      { kind: 'push-requested' },
      { kind: 'stat-done', result: { ok: false, error: { kind: 'server', status: 503 } } },
    ]).state;

    expect(syncStep(waiting, { kind: 'retry-due', attempt: 7 })).toEqual({
      state: waiting,
      effects: [],
    });
    expect(kinds(syncStep(waiting, { kind: 'retry-due', attempt: 1 }).effects)).toEqual(['stat']);
  });

  it('retries a seal the codec lost to a crashed worker, and drops one cut short by the session ending', () => {
    const sealing = run(synced, [
      { kind: 'push-requested' },
      { kind: 'stat-done', result: { ok: true, value: stat('r5') } },
    ]).state;

    const crashed = syncStep(sealing, { kind: 'seal-failed', failure: { kind: 'crashed' } });
    const aborted = syncStep(sealing, { kind: 'seal-failed', failure: { kind: 'aborted' } });

    expect(kinds(crashed.effects)).toEqual(['schedule-retry']);
    expect(crashed.state.context.pending).toBe(true);
    expect(aborted.state.phase).toEqual({ kind: 'idle' });
  });
});
