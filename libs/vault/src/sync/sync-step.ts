import type { TStorageError, TStorageResult } from '@frozik/cloud-storage/core/storage-error';
import type {
  IStorageObject,
  IStorageObjectStat,
  TWritePrecondition,
  TWriteResult,
} from '@frozik/cloud-storage/core/storage-provider';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';

import type { TSyncEffect } from './sync-effects';
import type { IOpenedHeader, TSyncEvent } from './sync-events';
import type {
  ISyncContext,
  ISyncGuard,
  ISyncState,
  TSyncIntent,
  TSyncPhase,
  TSyncStop,
} from './sync-state';

export interface ISyncTransition {
  readonly state: ISyncState;
  readonly effects: readonly TSyncEffect[];
}

/** Conflicts in a row before the engine waits for a timer instead of retrying at once. */
export const MAX_IMMEDIATE_CONFLICTS = 5;

function stay(state: ISyncState): ISyncTransition {
  return { state, effects: [] };
}

function go(
  context: ISyncContext,
  phase: TSyncPhase,
  effects: readonly TSyncEffect[] = []
): ISyncTransition {
  return { state: { context, phase }, effects };
}

function saveGuard(context: ISyncContext): TSyncEffect {
  return { kind: 'save-guard', guard: context.guard, lastSyncedRev: context.lastSyncedRev };
}

function startCycle(context: ISyncContext, intent: TSyncIntent): ISyncTransition {
  return go({ ...context, pending: false }, { kind: 'statting', intent }, [{ kind: 'stat' }]);
}

/** A cycle ended well: another one follows at once if something came in meanwhile. */
function finish(context: ISyncContext, effects: readonly TSyncEffect[]): ISyncTransition {
  const settled = { ...context, attempt: 0 };
  if (settled.pending) {
    const next = startCycle(settled, 'push');
    return { state: next.state, effects: [...effects, ...next.effects] };
  }
  return go(settled, { kind: 'idle' }, effects);
}

/** Offline waits for `online`, a rate limit or a server error for a timer; the local change stays pending. */
function fail(context: ISyncContext, error: TStorageError): ISyncTransition {
  if (error.kind === 'aborted') {
    return go(context, { kind: 'idle' });
  }
  const pending = { ...context, pending: true };
  if (error.kind === 'rate-limited' || error.kind === 'server') {
    const attempt = context.attempt + 1;
    return go({ ...pending, attempt }, { kind: 'waiting', cause: error }, [
      { kind: 'schedule-retry', attempt },
    ]);
  }
  return go(pending, { kind: 'waiting', cause: error });
}

function stop(context: ISyncContext, reason: TSyncStop): ISyncTransition {
  return go(context, { kind: 'stopped', reason });
}

function request(state: ISyncState, intent: TSyncIntent): ISyncTransition {
  switch (state.phase.kind) {
    case 'idle':
      return startCycle(state.context, intent);
    case 'waiting':
      return startCycle(state.context, state.context.pending ? 'push' : intent);
    case 'stopped':
      return stay(state);
    default:
      return go({ ...state.context, pending: true }, state.phase);
  }
}

function resume(state: ISyncState): ISyncTransition {
  return state.phase.kind === 'waiting'
    ? startCycle(state.context, state.context.pending ? 'push' : 'pull')
    : stay(state);
}

function seal(
  context: ISyncContext,
  precondition: TWritePrecondition,
  after: number
): ISyncTransition {
  const revision = Math.max(after, context.guard.maxSeenRevision) + 1;
  return go(context, { kind: 'sealing', precondition, revision }, [{ kind: 'seal', revision }]);
}

function onStat(
  state: ISyncState,
  result: TStorageResult<IStorageObjectStat | null>
): ISyncTransition {
  if (state.phase.kind !== 'statting') {
    return stay(state);
  }
  const { context } = state;
  if (!result.ok) {
    return fail(context, result.error);
  }
  const stat = result.value;
  const intent = state.phase.intent;
  if (isNil(stat)) {
    return intent === 'push' || !isNil(context.lastSyncedRev)
      ? seal(context, { kind: 'absent' }, 0)
      : finish(context, []);
  }
  if (stat.rev === context.lastSyncedRev) {
    return intent === 'push'
      ? seal(context, { kind: 'match', rev: stat.rev }, 0)
      : finish(context, []);
  }
  return go(context, { kind: 'reading', stat }, [{ kind: 'read' }]);
}

function onRead(state: ISyncState, result: TStorageResult<IStorageObject | null>): ISyncTransition {
  if (state.phase.kind !== 'reading') {
    return stay(state);
  }
  if (!result.ok) {
    return fail(state.context, result.error);
  }
  if (isNil(result.value)) {
    return startCycle(state.context, 'push');
  }
  return go(state.context, { kind: 'opening', stat: result.value.stat }, [
    { kind: 'open', file: result.value.bytes },
  ]);
}

function rejection(header: IOpenedHeader, context: ISyncContext): TSyncStop | null {
  if (header.vaultId !== context.guard.vaultId) {
    return { kind: 'foreign-vault' };
  }
  if (header.keyId !== context.guard.keyId) {
    return { kind: 'key-rotated' };
  }
  if (header.keyslotsEpoch < context.guard.maxSeenKeyslotsEpoch) {
    return { kind: 'rollback-security' };
  }
  if (!isNil(header.movedTo)) {
    return { kind: 'moved', to: header.movedTo };
  }
  return header.access === 'read-only' ? { kind: 'read-only' } : null;
}

/** Older than a file seen before, or the same revision with other bytes: merged, with a quiet warning. */
function isRollback(header: IOpenedHeader, guard: ISyncGuard): boolean {
  if (header.revision !== guard.maxSeenRevision) {
    return header.revision < guard.maxSeenRevision;
  }
  return !isNil(guard.hashAtMaxSeen) && guard.hashAtMaxSeen !== header.fileHash;
}

function seeRevision(guard: ISyncGuard, revision: number, fileHash: string): ISyncGuard {
  if (revision > guard.maxSeenRevision) {
    return { ...guard, maxSeenRevision: revision, hashAtMaxSeen: fileHash };
  }
  return revision === guard.maxSeenRevision && isNil(guard.hashAtMaxSeen)
    ? { ...guard, hashAtMaxSeen: fileHash }
    : guard;
}

function onOpened(
  state: ISyncState,
  result: Extract<TSyncEvent, { kind: 'opened' }>['result']
): ISyncTransition {
  if (state.phase.kind !== 'opening') {
    return stay(state);
  }
  const { context } = state;
  const { stat } = state.phase;
  if (!result.ok) {
    switch (result.error.kind) {
      case 'aborted':
        return go(context, { kind: 'idle' });
      case 'crashed':
        return fail(context, { kind: 'server', status: 0 });
      case 'key-rotated':
        return stop(
          context,
          result.error.stale ||
            (!isNil(result.error.keyId) && context.guard.retiredKeyIds.includes(result.error.keyId))
            ? { kind: 'rollback-security' }
            : { kind: 'key-rotated' }
        );
      case 'foreign-vault':
        return stop(context, { kind: 'foreign-vault' });
      case 'unreadable':
        return stop(context, { kind: 'corrupted' });
      default:
        return assertNever(result.error);
    }
  }
  const { header, document, keys } = result.value;
  const reason = rejection(header, context);
  if (!isNil(reason)) {
    return stop(context, reason);
  }
  const seen = {
    ...context,
    rolledBack: context.rolledBack || isRollback(header, context.guard),
    guard: {
      ...seeRevision(context.guard, header.revision, header.fileHash),
      maxSeenKeyslotsEpoch: Math.max(context.guard.maxSeenKeyslotsEpoch, header.keyslotsEpoch),
    },
  };
  return go(seen, { kind: 'merging', stat, remoteRevision: header.revision }, [
    { kind: 'merge', remote: document, keys },
    saveGuard(seen),
  ]);
}

function onMerged(state: ISyncState, localHasNews: boolean): ISyncTransition {
  if (state.phase.kind !== 'merging') {
    return stay(state);
  }
  const { stat, remoteRevision } = state.phase;
  if (!localHasNews) {
    const synced = { ...state.context, lastSyncedRev: stat.rev };
    return finish(synced, [saveGuard(synced)]);
  }
  return seal(state.context, { kind: 'match', rev: stat.rev }, remoteRevision);
}

function onSealed(
  state: ISyncState,
  { file, fileHash, keyslotsEpoch }: Extract<TSyncEvent, { kind: 'sealed' }>
): ISyncTransition {
  if (state.phase.kind !== 'sealing') {
    return stay(state);
  }
  const { precondition, revision } = state.phase;
  return go(state.context, { kind: 'writing', precondition, revision, fileHash, keyslotsEpoch }, [
    { kind: 'write', file, precondition },
  ]);
}

function onSealFailed(state: ISyncState, failure: 'aborted' | 'crashed'): ISyncTransition {
  if (state.phase.kind !== 'sealing') {
    return stay(state);
  }
  return failure === 'aborted'
    ? go(state.context, { kind: 'idle' })
    : fail(state.context, { kind: 'server', status: 0 });
}

function onWritten(state: ISyncState, result: TStorageResult<TWriteResult>): ISyncTransition {
  if (state.phase.kind !== 'writing') {
    return stay(state);
  }
  const { context } = state;
  if (!result.ok) {
    return fail(context, result.error);
  }
  if (result.value.kind === 'conflict') {
    const attempt = context.attempt + 1;
    if (attempt >= MAX_IMMEDIATE_CONFLICTS) {
      return go(
        { ...context, attempt, pending: true },
        { kind: 'waiting', cause: { kind: 'conflicts' } },
        [{ kind: 'schedule-retry', attempt }]
      );
    }
    return startCycle({ ...context, attempt }, 'push');
  }
  const { revision, fileHash, keyslotsEpoch } = state.phase;
  const seen = seeRevision(context.guard, revision, fileHash);
  const written = {
    ...context,
    lastSyncedRev: result.value.stat.rev,
    guard: {
      ...seen,
      maxSeenKeyslotsEpoch: Math.max(seen.maxSeenKeyslotsEpoch, keyslotsEpoch),
    },
  };
  return finish(written, [saveGuard(written), { kind: 'keys-shared', keyslotsEpoch }]);
}

/**
 * The sync engine as a pure step: no `await`, no clock, no I/O.
 * The shell runs the effects and feeds their outcomes back as events; a test
 * can be the shell and interleave many engines from a seed.
 * An event that does not fit the phase (a late answer after a restart) is ignored.
 */
export function syncStep(state: ISyncState, event: TSyncEvent): ISyncTransition {
  switch (event.kind) {
    case 'push-requested':
      return request(state, 'push');
    case 'pull-requested':
      return request(state, 'pull');
    case 'retry-due':
      return event.attempt === state.context.attempt ? resume(state) : stay(state);
    case 'online':
      return resume(state);
    case 'stat-done':
      return onStat(state, event.result);
    case 'read-done':
      return onRead(state, event.result);
    case 'opened':
      return onOpened(state, event.result);
    case 'merged':
      return onMerged(state, event.localHasNews);
    case 'sealed':
      return onSealed(state, event);
    case 'seal-failed':
      return onSealFailed(state, event.failure.kind);
    case 'write-done':
      return onWritten(state, event.result);
    default:
      return assertNever(event);
  }
}
