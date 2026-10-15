import { assert } from '@frozik/utils/assert/assert';
import { parseRecoveryKey } from '@frozik/vault/crypto/recovery-key';
import { when } from 'mobx';

import type { VaultApp } from '../../session/application/VaultApp';
import { aDevice, TEST_PASSWORD } from '../../testing/fake-device';
import { ChangePasswordForm } from './ChangePasswordForm';
import type { RecoveryKeyFlow } from './RecoveryKeyFlow';

const NEW_PASSWORD = 'a brand new master password';
const KIT = { name: 'Emergency Kit.pdf', mime: 'application/pdf', bytes: Uint8Array.of(1) };

async function unlocked(device: ReturnType<typeof aDevice>) {
  const store = device.startStore();
  store.create('Family', TEST_PASSWORD);
  await when(() => store.session !== null);
  const { session } = store;
  assert(session !== null);
  return { store, session };
}

/** Makes a key, types its last group back and confirms with the master password; the key as printed. */
async function confirmedKey(flow: RecoveryKeyFlow): Promise<string> {
  flow.start();
  const { step } = flow;
  assert(step.kind === 'shown');
  flow.toConfirmation();
  flow.setLastGroup(step.formatted.split('-').at(-1)?.toLowerCase() ?? '');
  flow.setPassword(TEST_PASSWORD);
  await flow.confirm();
  return step.formatted;
}

async function reopenedWith(
  device: ReturnType<typeof aDevice>,
  vaultKey: string,
  recoveryKey: string
): Promise<VaultApp> {
  const store = device.startStore();
  store.choose(vaultKey);
  const parsed = parseRecoveryKey(recoveryKey);
  assert(parsed.ok);
  store.unlockWithRecoveryKey(parsed.value);
  await when(() => store.session !== null || store.lifecycle.kind === 'locked');
  return store;
}

describe('the recovery key', () => {
  it('is written only after its last group is typed back, with the master password', async () => {
    const device = aDevice();
    const { session } = await unlocked(device);
    const flow = session.flows.recoveryKeyOf(() => Promise.resolve(KIT));

    flow.start();
    flow.toConfirmation();
    flow.setLastGroup('0000');
    flow.setPassword(TEST_PASSWORD);
    expect(flow.canConfirm).toBe(false);
    await flow.confirm();
    expect(session.keys.hasRecoveryKey).toBe(false);

    await confirmedKey(flow);
    expect(flow.step).toEqual({ kind: 'done' });
    expect(session.keys.hasRecoveryKey).toBe(true);
  });

  it('opens a vault whose password is forgotten, and asks for a new password with it', async () => {
    const device = aDevice();
    const { store, session } = await unlocked(device);
    const key = await confirmedKey(session.flows.recoveryKeyOf(() => Promise.resolve(KIT)));
    await when(() => session.local.state.phase.kind === 'idle');
    store.dispose();

    const recovered = await reopenedWith(device, session.vaultKey, key);
    const keys = recovered.session?.keys;
    assert(keys !== undefined);
    expect(keys.recovering).toBe(true);
    const form = new ChangePasswordForm(keys, 'recovery');
    form.setCurrent(key);
    form.setPassword(NEW_PASSWORD);
    form.setConfirmation(NEW_PASSWORD);
    await form.submit();
    expect(form.step).toEqual({ kind: 'changed' });
    expect(keys.recovering).toBe(false);
    await when(() => recovered.session?.local.state.phase.kind === 'idle');
    recovered.dispose();

    const again = device.startStore();
    again.choose(session.vaultKey);
    again.unlock(NEW_PASSWORD);
    await when(() => again.lifecycle.kind === 'unlocked' || again.lifecycle.kind === 'locked');
    expect(again.lifecycle.kind).toBe('unlocked');
  });

  it('stops opening the vault once a new one is made', async () => {
    const device = aDevice();
    const { store, session } = await unlocked(device);
    const flow = session.flows.recoveryKeyOf(() => Promise.resolve(KIT));
    const first = await confirmedKey(flow);
    await confirmedKey(flow);
    await when(() => session.local.state.phase.kind === 'idle');
    store.dispose();

    const withOld = await reopenedWith(device, session.vaultKey, first);

    expect(withOld.lifecycle).toMatchObject({ kind: 'locked', failure: 'wrong-password' });
  });

  it('offers its Emergency Kit to save from the click', async () => {
    const device = aDevice();
    const { session } = await unlocked(device);
    const flow = session.flows.recoveryKeyOf(() => Promise.resolve(KIT));

    flow.start();
    await when(() => flow.kit.kind === 'ready');
    flow.saveKit();

    expect(device.saved).toEqual([KIT]);
  });
});
