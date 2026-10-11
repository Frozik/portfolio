import type { TLifecycleEffect } from './lifecycle-effects';
import type { TLifecycleEvent } from './lifecycle-events';
import type { TLifecycleState } from './lifecycle-state';
import { lifecycleStep } from './lifecycle-step';

const password = Uint8Array.of(112, 97, 115, 115);
const locked: TLifecycleState = { kind: 'locked', vaultKey: 'v1', reason: null, failure: null };
const unlocked: TLifecycleState = { kind: 'unlocked', vaultKey: 'v1' };

function run(
  state: TLifecycleState,
  events: readonly TLifecycleEvent[]
): { readonly state: TLifecycleState; readonly effects: readonly TLifecycleEffect[] } {
  return events.reduce<{ state: TLifecycleState; effects: readonly TLifecycleEffect[] }>(
    (current, event) => {
      const next = lifecycleStep(current.state, event);
      return { state: next.state, effects: [...current.effects, ...next.effects] };
    },
    { state, effects: [] }
  );
}

describe('vault lifecycle', () => {
  it('creates a vault and opens a session on it', () => {
    const { state, effects } = run({ kind: 'no-vault' }, [
      { kind: 'create-requested', name: 'Personal', password },
      { kind: 'created', result: { ok: true, value: 'v1' } },
    ]);

    expect(state).toEqual(unlocked);
    expect(effects).toEqual([
      { kind: 'create', name: 'Personal', password },
      { kind: 'start-session', vaultKey: 'v1', access: 'read-write' },
    ]);
  });

  it('unlocks with the credential, and keeps the credential out of every state', () => {
    const credential = { kind: 'password', password } as const;
    const unlocking = lifecycleStep(locked, { kind: 'unlock-requested', credential });
    const opened = lifecycleStep(unlocking.state, {
      kind: 'opened',
      result: { ok: true, value: 'read-write' },
    });

    expect(unlocking.effects).toEqual([{ kind: 'open', vaultKey: 'v1', credential }]);
    expect(JSON.stringify(unlocking.state)).not.toContain('password');
    expect(opened.state).toEqual(unlocked);
  });

  it('goes back to the unlock screen with the reason when the password is wrong', () => {
    const { state } = run(locked, [
      { kind: 'unlock-requested', credential: { kind: 'password', password } },
      { kind: 'opened', result: { ok: false, error: 'wrong-password' } },
    ]);

    expect(state).toEqual({ ...locked, failure: 'wrong-password' });
  });

  it('opens a vault of a newer schema read-only', () => {
    const { state, effects } = run(locked, [
      { kind: 'unlock-requested', credential: { kind: 'password', password } },
      { kind: 'opened', result: { ok: true, value: 'read-only' } },
    ]);

    expect(state).toEqual({ kind: 'read-only', vaultKey: 'v1' });
    expect(effects.at(-1)).toEqual({ kind: 'start-session', vaultKey: 'v1', access: 'read-only' });
  });

  it('locks by flushing the draft first, then ending the session with a reload', () => {
    const { state, effects } = run(unlocked, [
      { kind: 'lock-requested', reason: 'idle' },
      { kind: 'draft-flushed' },
    ]);

    expect(effects).toEqual([
      { kind: 'flush-draft' },
      { kind: 'end-session-and-reload', vaultKey: 'v1', reason: 'idle' },
    ]);
    expect(state).toEqual({ ...locked, reason: 'idle' });
  });

  it('cannot be talked out of locking once it started', () => {
    const locking = lifecycleStep(unlocked, { kind: 'lock-requested', reason: 'hidden' }).state;

    expect(lifecycleStep(locking, { kind: 'lock-requested', reason: 'manual' }).state).toBe(
      locking
    );
    expect(
      lifecycleStep(locking, {
        kind: 'unlock-requested',
        credential: { kind: 'password', password },
      }).state
    ).toBe(locking);
  });

  it('locks when the cloud rolled back what guards the vault', () => {
    const { state, effects } = run(unlocked, [
      { kind: 'sync-stopped', stop: { kind: 'rollback-security' } },
    ]);

    expect(state).toEqual({ kind: 'locking', vaultKey: 'v1', reason: 'rollback-security' });
    expect(effects).toEqual([{ kind: 'flush-draft' }]);
  });

  it('stays open when the key was rotated elsewhere: the session follows it with the password', () => {
    expect(run(unlocked, [{ kind: 'sync-stopped', stop: { kind: 'key-rotated' } }])).toEqual({
      state: unlocked,
      effects: [],
    });
  });

  it('turns read-only when the cloud holds a newer schema, and follows a vault that moved', () => {
    expect(run(unlocked, [{ kind: 'sync-stopped', stop: { kind: 'read-only' } }])).toEqual({
      state: { kind: 'read-only', vaultKey: 'v1' },
      effects: [{ kind: 'make-read-only' }],
    });
    expect(
      run(unlocked, [
        { kind: 'sync-stopped', stop: { kind: 'moved', to: 'webdav:https://dav.example/v.pwv' } },
      ])
    ).toEqual({
      state: unlocked,
      effects: [{ kind: 'relocate', vaultKey: 'v1', to: 'webdav:https://dav.example/v.pwv' }],
    });
  });

  it('leaves a foreign vault at the same place to the sync dialog', () => {
    expect(run(unlocked, [{ kind: 'sync-stopped', stop: { kind: 'foreign-vault' } }])).toEqual({
      state: unlocked,
      effects: [],
    });
  });

  it('forgets everything on request, ending an open session with a reload', () => {
    expect(lifecycleStep(unlocked, { kind: 'forgotten' })).toEqual({
      state: { kind: 'no-vault' },
      effects: [{ kind: 'end-session-and-reload', vaultKey: 'v1', reason: 'forgotten' }],
    });
    expect(lifecycleStep(locked, { kind: 'forgotten' })).toEqual({
      state: { kind: 'no-vault' },
      effects: [],
    });
  });

  it('keeps a lock that arrives while the key is derived, and never opens the session', () => {
    const { state, effects } = run(locked, [
      { kind: 'unlock-requested', credential: { kind: 'password', password } },
      { kind: 'lock-requested', reason: 'other-tab' },
      { kind: 'opened', result: { ok: true, value: 'read-write' } },
    ]);

    expect(state).toEqual({ ...locked, reason: 'other-tab' });
    expect(effects.map(effect => effect.kind)).toEqual(['open', 'end-session-and-reload']);
  });
});
