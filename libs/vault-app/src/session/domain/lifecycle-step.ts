import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';

import type { TSyncStop } from '@frozik/vault/sync/sync-state';
import type { TLifecycleEffect } from './lifecycle-effects';
import type { TLifecycleEvent } from './lifecycle-events';
import type { TLifecycleState, TLockReason } from './lifecycle-state';
import { isFullyLocked } from './lifecycle-state';
import { lockConsequence } from './lock-policy';

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

type TLocked = Extract<TLifecycleState, { readonly kind: 'locked' }>;

function fullyLocked(vaultKey: string, reason: TLockReason): TLocked {
  return { kind: 'locked', vaultKey, level: 'full', reason, failure: null };
}

/** A quick lock ends fully: the process goes, and the key kept behind the code with it. */
function endQuickLock(state: TLocked, reason: TLockReason): ILifecycleTransition {
  return go(fullyLocked(state.vaultKey, reason), [
    { kind: 'end-session-and-reload', vaultKey: state.vaultKey, reason },
  ]);
}

function lock(state: TLifecycleState, reason: TLockReason): ILifecycleTransition {
  if (state.kind === 'unlocking') {
    return go({ ...state, pendingLock: state.pendingLock ?? reason });
  }
  const full = lockConsequence(reason, true).level === 'full';
  if (state.kind === 'locked') {
    return state.level === 'quick' && full ? endQuickLock(state, reason) : stay(state);
  }
  if (state.kind === 'locking') {
    return state.level === 'quick' && full ? go({ ...state, level: 'full', reason }) : stay(state);
  }
  if (state.kind !== 'unlocked' && state.kind !== 'read-only') {
    return stay(state);
  }
  const { level } = lockConsequence(reason, state.quickReady);
  return go({ kind: 'locking', vaultKey: state.vaultKey, reason, level }, [
    { kind: 'flush-draft' },
  ]);
}

function opened(
  state: Extract<TLifecycleState, { readonly kind: 'unlocking' }>,
  result: Extract<TLifecycleEvent, { readonly kind: 'opened' }>['result']
): ILifecycleTransition {
  if (!result.ok) {
    return state.via === 'quick'
      ? endQuickLock(state.from, 'quick-unlock-failed')
      : go({ ...state.from, failure: result.error });
  }
  if (!isNil(state.pendingLock)) {
    return go(fullyLocked(state.vaultKey, state.pendingLock), [
      { kind: 'end-session-and-reload', vaultKey: state.vaultKey, reason: state.pendingLock },
    ]);
  }
  return go(
    result.value === 'read-only'
      ? { kind: 'read-only', vaultKey: state.vaultKey, quickReady: false }
      : { kind: 'unlocked', vaultKey: state.vaultKey, quickReady: false },
    [{ kind: 'start-session', vaultKey: state.vaultKey, access: result.value }]
  );
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
        ? go({ ...state, kind: 'read-only' }, [{ kind: 'make-read-only' }])
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
      return state.kind === 'no-vault' || (state.kind === 'locked' && state.level === 'full')
        ? go({
            kind: 'locked',
            vaultKey: event.vaultKey,
            level: event.kept ? 'quick' : 'full',
            reason: event.reason,
            failure: null,
          })
        : stay(state);
    case 'create-requested':
      return isFullyLocked(state)
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
        ? go({ kind: 'unlocked', vaultKey: event.result.value, quickReady: false }, [
            { kind: 'start-session', vaultKey: event.result.value, access: 'read-write' },
          ])
        : go({ kind: 'no-vault' });
    case 'unlock-requested':
      return state.kind === 'locked'
        ? go(
            {
              kind: 'unlocking',
              vaultKey: state.vaultKey,
              pendingLock: null,
              via: 'credential',
              from: { ...state, failure: null },
            },
            [{ kind: 'open', vaultKey: state.vaultKey, credential: event.credential }]
          )
        : stay(state);
    case 'quick-unlock-requested':
      return state.kind === 'locked' && state.level === 'quick'
        ? go(
            {
              kind: 'unlocking',
              vaultKey: state.vaultKey,
              pendingLock: null,
              via: 'quick',
              from: state,
            },
            [{ kind: 'quick-open', vaultKey: state.vaultKey, code: event.code }]
          )
        : stay(state);
    case 'device-unlock-requested':
      return state.kind === 'locked'
        ? go(
            {
              kind: 'unlocking',
              vaultKey: state.vaultKey,
              pendingLock: null,
              via: 'device',
              from: { ...state, failure: null },
            },
            [{ kind: 'device-open', vaultKey: state.vaultKey }]
          )
        : stay(state);
    case 'unlock-cancelled':
      return state.kind === 'unlocking' && state.via === 'device' ? go(state.from) : stay(state);
    case 'opened':
      return state.kind === 'unlocking' ? opened(state, event.result) : stay(state);
    case 'lock-requested':
      return lock(state, event.reason);
    case 'draft-flushed':
      if (state.kind !== 'locking') {
        return stay(state);
      }
      return state.level === 'quick'
        ? go(state, [{ kind: 'quick-lock', vaultKey: state.vaultKey }])
        : go(fullyLocked(state.vaultKey, state.reason), [
            { kind: 'end-session-and-reload', vaultKey: state.vaultKey, reason: state.reason },
          ]);
    case 'sync-stopped':
      return onSyncStopped(state, event.stop);
    case 'forgotten':
      return 'vaultKey' in state && (state.kind !== 'locked' || state.level === 'quick')
        ? go({ kind: 'no-vault' }, [
            { kind: 'end-session-and-reload', vaultKey: state.vaultKey, reason: 'forgotten' },
          ])
        : go({ kind: 'no-vault' });
    case 'quick-unlock-changed':
      return state.kind === 'unlocked' || state.kind === 'read-only'
        ? go({ ...state, quickReady: event.ready })
        : stay(state);
    case 'quick-locked':
      if (state.kind !== 'locking') {
        return stay(state);
      }
      return event.held && state.level === 'quick'
        ? go({ ...state, kind: 'locked', failure: null })
        : go(fullyLocked(state.vaultKey, state.reason), [
            { kind: 'end-session-and-reload', vaultKey: state.vaultKey, reason: state.reason },
          ]);
    case 'quick-expired':
      return state.kind === 'locked' && state.level === 'quick'
        ? endQuickLock(state, 'quick-expired')
        : stay(state);
    default:
      return assertNever(event);
  }
}
