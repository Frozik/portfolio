import { assert } from '@frozik/utils/assert/assert';
import type { Milliseconds } from '@frozik/utils/date/types';
import { when } from 'mobx';

import { LOCK_CHECK_INTERVAL_MS } from '../../session/domain/lock-deadline';
import { aDevice } from '../../testing/fake-device';
import { DEFAULT_DEVICE_SETTINGS } from '../domain/device-settings';
import { DEFAULT_LOCK_TIMEOUTS } from '../domain/lock-timeouts';
import { decodeDeviceSettings } from './DeviceSettingsModel';

const PASSWORD = 'correct horse battery staple';
const MINUTE_MS = 60_000;

describe('device settings', () => {
  it('locks by the new idle timeout at once, and keeps it for the next session', async () => {
    const device = aDevice();
    const first = device.startStore();
    first.create('Home', PASSWORD);
    await when(() => first.session !== null);
    const session = first.session;
    assert(session !== null);
    const vaultKey = session.vaultKey;

    session.deviceSettings.update({
      lock: { ...DEFAULT_LOCK_TIMEOUTS, idle: MINUTE_MS as Milliseconds },
    });
    device.time.advance(MINUTE_MS + LOCK_CHECK_INTERVAL_MS);
    await when(() => first.lifecycle.kind === 'locked');

    const second = device.startStore();
    second.choose(vaultKey);
    second.unlock(PASSWORD);
    await when(() => second.session?.deviceSettings.settings.lock.idle === MINUTE_MS);

    expect(second.session?.deviceSettings.settings.lock.idle).toBe(MINUTE_MS);
  });

  it('keeps screenshots blocked until allowed, and remembers the choice on this device', async () => {
    const device = aDevice();
    const first = device.startStore();
    first.create('Home', PASSWORD);
    await when(() => first.session !== null);
    const session = first.session;
    assert(session !== null);
    const blockedAtFirst = session.deviceSettings.settings.allowScreenshots;

    session.deviceSettings.update({ allowScreenshots: true });
    await session.deviceSettings.saved();
    first.lock('manual');
    const second = device.startStore();
    second.choose(session.vaultKey);
    second.unlock(PASSWORD);
    await when(() => second.session?.deviceSettings.settings.allowScreenshots === true);

    expect(blockedAtFirst).toBe(false);
  });

  it('reads a record saved before the screenshot choice existed as blocked', () => {
    const { allowScreenshots, ...older } = DEFAULT_DEVICE_SETTINGS;

    expect([allowScreenshots, decodeDeviceSettings(older)?.allowScreenshots]).toEqual([
      false,
      false,
    ]);
  });

  it('follows every change of the timeouts, not only the first', async () => {
    const device = aDevice();
    const store = device.startStore();
    store.create('Home', PASSWORD);
    await when(() => store.session !== null);
    const session = store.session;
    assert(session !== null);

    session.deviceSettings.update({
      lock: { ...DEFAULT_LOCK_TIMEOUTS, idle: (15 * MINUTE_MS) as Milliseconds },
    });
    session.deviceSettings.update({
      lock: { ...DEFAULT_LOCK_TIMEOUTS, idle: MINUTE_MS as Milliseconds },
    });
    device.time.advance(MINUTE_MS + LOCK_CHECK_INTERVAL_MS);

    expect(store.lifecycle.kind).not.toBe('unlocked');
  });

  it('keeps a change made before the stored settings arrived', async () => {
    const device = aDevice();
    const first = device.startStore();
    first.create('Home', PASSWORD);
    await when(() => first.session !== null);
    const vaultKey = first.session?.vaultKey ?? '';
    first.session?.deviceSettings.update({
      lock: { ...DEFAULT_LOCK_TIMEOUTS, idle: MINUTE_MS as Milliseconds },
    });
    await first.session?.deviceSettings.saved();
    first.lock('manual');

    const second = device.startStore();
    second.choose(vaultKey);
    second.unlock(PASSWORD);
    await when(() => second.session !== null);
    const changedAtOnce = 2 * MINUTE_MS;
    second.session?.deviceSettings.update({
      lock: { ...DEFAULT_LOCK_TIMEOUTS, idle: changedAtOnce as Milliseconds },
    });
    await second.session?.deviceSettings.loaded();

    expect(second.session?.deviceSettings.settings.lock.idle).toBe(changedAtOnce);
  });
});
