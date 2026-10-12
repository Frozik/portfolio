import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';

import type { TSyncStop } from '../sync/sync-state';
import type { TLifecycleEffect } from './lifecycle-effects';
import type { TLifecycleEvent } from './lifecycle-events';
import type { TLifecycleState, TLockReason } from './lifecycle-state';

export interface ILifecycleTransition {
  readonly state: TLifecycleState;
  readonly effects: readonly TLifecycleEffect[];
}

function stay(state: TLifecycleState): ILifecycleTransition {
  return { state, effects: [] };
}

function go(
  state: TLifecycleState,
  effects: readonly TLifecycleEffect[] = []
): ILifecycleTransition {
  return { state, effects };
}

function lock(state: TLifecycleState, reason: TLockReason): ILifecycleTransition {
  if (state.kind === 'unlocking') {
    return go({ ...state, pendingLock: state.pendingLock ?? reason });
  }
  if (state.kind !== 'unlocked' && state.kind !== 'read-only') {
    return stay(state);
  }
  return go({ kind: 'locking', vaultKey: state.vaultKey, reason }, [{ kind: 'flush-draft' }]);
}

function onSyncStopped(state: TLifecycleState, stop: TSyncStop): ILifecycleTransition {
  if (state.kind !== 'unlocked' && state.kind !== 'read-only') {
    return stay(state);
  }
  switch (stop.kind) {
    case 'rollback-security':
      return lock(state, stop.kind);
    case 'read-only':
      return state.kind === 'unlocked'
        ? go({ kind: 'read-only', vaultKey: state.vaultKey }, [{ kind: 'make-read-only' }])
        : stay(state);
    case 'moved':
      return go(state, [{ kind: 'relocate', vaultKey: state.vaultKey, to: stop.to }]);
    /** The session asks for the password and follows the new key itself. */
    case 'key-rotated':
    case 'foreign-vault':
    case 'corrupted':
      return stay(state);
    default:
      return assertNever(stop);
  }
}

/**
 * The lifecycle as a pure step (effects as data, D20). Locking
 * cannot be cancelled: once `locking`, only the flushed draft moves on, to a
 * reload.
 */
export function lifecycleStep(
  state: TLifecycleState,
  event: TLifecycleEvent
): ILifecycleTransition {
  switch (event.kind) {
    case 'vault-chosen':
      return state.kind === 'no-vault' || state.kind === 'locked'
        ? go({ kind: 'locked', vaultKey: event.vaultKey, reason: null, failure: null })
        : stay(state);
    case 'create-requested':
      return state.kind === 'no-vault'
        ? go({ kind: 'creating' }, [
            {
              kind: 'create',
              name: event.name,
              description: event.description,
              password: event.password,
            },
          ])
        : stay(state);
    case 'created':
      if (state.kind !== 'creating') {
        return stay(state);
      }
      return event.result.ok
        ? go({ kind: 'unlocked', vaultKey: event.result.value }, [
            { kind: 'start-session', vaultKey: event.result.value, access: 'read-write' },
          ])
        : go({ kind: 'no-vault' });
    case 'unlock-requested':
      return state.kind === 'locked'
        ? go({ kind: 'unlocking', vaultKey: state.vaultKey, pendingLock: null }, [
            { kind: 'open', vaultKey: state.vaultKey, credential: event.credential },
          ])
        : stay(state);
    case 'opened':
      if (state.kind !== 'unlocking') {
        return stay(state);
      }
      if (!event.result.ok) {
        return go({
          kind: 'locked',
          vaultKey: state.vaultKey,
          reason: null,
          failure: event.result.error,
        });
      }
      if (!isNil(state.pendingLock)) {
        return go(
          { kind: 'locked', vaultKey: state.vaultKey, reason: state.pendingLock, failure: null },
          [{ kind: 'end-session-and-reload', vaultKey: state.vaultKey, reason: state.pendingLock }]
        );
      }
      return go(
        event.result.value === 'read-only'
          ? { kind: 'read-only', vaultKey: state.vaultKey }
          : { kind: 'unlocked', vaultKey: state.vaultKey },
        [{ kind: 'start-session', vaultKey: state.vaultKey, access: event.result.value }]
      );
    case 'lock-requested':
      return lock(state, event.reason);
    case 'draft-flushed':
      return state.kind === 'locking'
        ? go({ kind: 'locked', vaultKey: state.vaultKey, reason: state.reason, failure: null }, [
            { kind: 'end-session-and-reload', vaultKey: state.vaultKey, reason: state.reason },
          ])
        : stay(state);
    case 'sync-stopped':
      return onSyncStopped(state, event.stop);
    case 'forgotten':
      return 'vaultKey' in state && state.kind !== 'locked'
        ? go({ kind: 'no-vault' }, [
            { kind: 'end-session-and-reload', vaultKey: state.vaultKey, reason: 'forgotten' },
          ])
        : go({ kind: 'no-vault' });
    default:
      return assertNever(event);
  }
}
