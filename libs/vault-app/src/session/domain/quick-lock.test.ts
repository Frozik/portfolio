import type { TLifecycleEffect } from './lifecycle-effects';
import type { TLifecycleEvent } from './lifecycle-events';
import type { TLifecycleState } from './lifecycle-state';
import { lifecycleStep } from './lifecycle-step';

const password = Uint8Array.of(112, 97, 115, 115);
const credential = { kind: 'password', password } as const;
const quickReady: TLifecycleState = { kind: 'unlocked', vaultKey: 'v1', quickReady: true };
const quickLocked: TLifecycleState = {
  kind: 'locked',
  vaultKey: 'v1',
  level: 'quick',
  reason: 'idle',
  failure: null,
};

function run(state: TLifecycleState, events: readonly TLifecycleEvent[]) {
  return events.reduce<{ state: TLifecycleState; effects: readonly TLifecycleEffect[] }>(
    (current, event) => {
      const next = lifecycleStep(current.state, event);
      return { state: next.state, effects: [...current.effects, ...next.effects] };
    },
    { state, effects: [] }
  );
}

describe('a quick lock', () => {
  it.each(['idle', 'concealed', 'sleep'] as const)(
    'is what %s does once quick unlock is ready: no wipe, the key kept behind the code',
    reason => {
      const { state, effects } = run(quickReady, [
        { kind: 'lock-requested', reason },
        { kind: 'draft-flushed' },
        { kind: 'quick-locked', held: true },
      ]);

      expect(state).toEqual({ ...quickLocked, reason });
      expect(effects).toEqual([{ kind: 'flush-draft' }, { kind: 'quick-lock', vaultKey: 'v1' }]);
    }
  );

  it.each([
    'complete',
    'unloading',
    'other-client',
    'rollback-security',
    'update-required',
  ] as const)('is never what %s does: that lock is full', reason => {
    const { state, effects } = run(quickReady, [
      { kind: 'lock-requested', reason },
      { kind: 'draft-flushed' },
    ]);

    expect(state).toMatchObject({ kind: 'locked', level: 'full', reason });
    expect(effects.at(-1)).toEqual({ kind: 'end-session-and-reload', vaultKey: 'v1', reason });
  });

  it('becomes full when the key could not be kept behind the code', () => {
    const { state, effects } = run(quickReady, [
      { kind: 'lock-requested', reason: 'idle' },
      { kind: 'draft-flushed' },
      { kind: 'quick-locked', held: false },
    ]);

    expect(state).toMatchObject({ kind: 'locked', level: 'full', reason: 'idle' });
    expect(effects.at(-1)).toEqual({
      kind: 'end-session-and-reload',
      vaultKey: 'v1',
      reason: 'idle',
    });
  });

  it('becomes full when a full lock is asked for while the key is being kept', () => {
    const { state, effects } = run(quickReady, [
      { kind: 'lock-requested', reason: 'idle' },
      { kind: 'draft-flushed' },
      { kind: 'lock-requested', reason: 'complete' },
      { kind: 'quick-locked', held: true },
    ]);

    expect(state).toMatchObject({ kind: 'locked', level: 'full', reason: 'complete' });
    expect(effects.at(-1)).toEqual({
      kind: 'end-session-and-reload',
      vaultKey: 'v1',
      reason: 'complete',
    });
  });

  it('is not offered before quick unlock is ready', () => {
    const { state } = run({ ...quickReady, quickReady: false }, [
      { kind: 'lock-requested', reason: 'idle' },
      { kind: 'draft-flushed' },
    ]);

    expect(state).toMatchObject({ level: 'full' });
  });

  it('follows the setting as it is switched on and off while open', () => {
    const off = lifecycleStep(quickReady, { kind: 'quick-unlock-changed', ready: false }).state;
    const on = lifecycleStep(off, { kind: 'quick-unlock-changed', ready: true }).state;

    expect(off).toEqual({ ...quickReady, quickReady: false });
    expect(on).toEqual(quickReady);
  });

  it('opens with the right code; the session then says again whether quick unlock is ready', () => {
    const { state, effects } = run(quickLocked, [
      { kind: 'quick-unlock-requested', code: 'pin:1234' },
      { kind: 'opened', result: { ok: true, value: 'read-write' } },
    ]);

    expect(effects).toEqual([
      { kind: 'quick-open', vaultKey: 'v1', code: 'pin:1234' },
      { kind: 'start-session', vaultKey: 'v1', access: 'read-write' },
    ]);
    expect(state).toEqual({ ...quickReady, quickReady: false });
  });

  it('gives one attempt: a wrong code locks fully and wipes', () => {
    const { state, effects } = run(quickLocked, [
      { kind: 'quick-unlock-requested', code: 'pin:0000' },
      { kind: 'opened', result: { ok: false, error: 'wrong-password' } },
      { kind: 'quick-unlock-requested', code: 'pin:1234' },
    ]);

    expect(state).toEqual({
      kind: 'locked',
      vaultKey: 'v1',
      level: 'full',
      reason: 'quick-unlock-failed',
      failure: null,
    });
    expect(effects).toEqual([
      { kind: 'quick-open', vaultKey: 'v1', code: 'pin:0000' },
      { kind: 'end-session-and-reload', vaultKey: 'v1', reason: 'quick-unlock-failed' },
    ]);
  });

  it('ends fully when its lifetime is over', () => {
    const { state, effects } = run(quickLocked, [{ kind: 'quick-expired' }]);

    expect(state).toMatchObject({ level: 'full', reason: 'quick-expired' });
    expect(effects).toEqual([
      { kind: 'end-session-and-reload', vaultKey: 'v1', reason: 'quick-expired' },
    ]);
  });

  it('never outlives a full lock asked for meanwhile', () => {
    const { state, effects } = run(quickLocked, [{ kind: 'lock-requested', reason: 'complete' }]);

    expect(state).toMatchObject({ level: 'full', reason: 'complete' });
    expect(effects).toEqual([
      { kind: 'end-session-and-reload', vaultKey: 'v1', reason: 'complete' },
    ]);
  });

  it('stays quick when another quick reason arrives meanwhile', () => {
    const { state, effects } = run(quickLocked, [{ kind: 'lock-requested', reason: 'concealed' }]);

    expect(state).toEqual(quickLocked);
    expect(effects).toEqual([]);
  });

  it('lets the master password in and keeps the code’s chance after a mistyped password', () => {
    const { state } = run(quickLocked, [
      { kind: 'unlock-requested', credential },
      { kind: 'opened', result: { ok: false, error: 'wrong-password' } },
    ]);

    expect(state).toEqual({ ...quickLocked, failure: 'wrong-password' });
  });

  it('ends fully when the vault is forgotten meanwhile', () => {
    const { state, effects } = run(quickLocked, [{ kind: 'forgotten' }]);

    expect(state).toEqual({ kind: 'no-vault' });
    expect(effects).toEqual([
      { kind: 'end-session-and-reload', vaultKey: 'v1', reason: 'forgotten' },
    ]);
  });
});

describe('a biometric unlock', () => {
  const locked: TLifecycleState = {
    kind: 'locked',
    vaultKey: 'v1',
    level: 'full',
    reason: 'manual',
    failure: null,
  };

  it('opens through the platform’s prompt', () => {
    const { state, effects } = run(locked, [
      { kind: 'device-unlock-requested' },
      { kind: 'opened', result: { ok: true, value: 'read-write' } },
    ]);

    expect(effects).toEqual([
      { kind: 'device-open', vaultKey: 'v1' },
      { kind: 'start-session', vaultKey: 'v1', access: 'read-write' },
    ]);
    expect(state).toMatchObject({ kind: 'unlocked' });
  });

  it('goes back to the unlock screen as it was when the user closes the prompt', () => {
    const { state } = run(locked, [
      { kind: 'device-unlock-requested' },
      { kind: 'unlock-cancelled' },
    ]);

    expect(state).toEqual(locked);
  });

  it('says why when the biometric key is gone, and keeps the lock as it was', () => {
    const { state } = run(locked, [
      { kind: 'device-unlock-requested' },
      { kind: 'opened', result: { ok: false, error: 'biometric-invalidated' } },
    ]);

    expect(state).toEqual({ ...locked, failure: 'biometric-invalidated' });
  });
});
