import { when } from 'mobx';

import { aDevice, TEST_PASSWORD } from '../../testing/fake-device';
import type { TVersionManifest } from '../domain/version-manifest';
import { lockWhenUpdateRequired } from './lock-when-update-required';
import { UpdateWatch } from './UpdateWatch';

function aVersionSource(initial: TVersionManifest | null) {
  let published = initial;
  return {
    source: { read: () => Promise.resolve(published) },
    publish: (next: TVersionManifest | null) => {
      published = next;
    },
  };
}

const RUNNING = { client: 'web', version: 'v1.2.0' } as const;

describe('the update watch', () => {
  it('learns of a newer release and of a raised floor', async () => {
    const versions = aVersionSource({ web: { latest: 'v1.3.0', minimum: 'v1.0.0' } });
    const watch = new UpdateWatch(versions.source, RUNNING);

    await watch.check();
    const offered = watch.verdict;
    versions.publish({ web: { latest: 'v1.3.0', minimum: 'v1.3.0' } });
    await watch.check();

    expect(offered).toBe('available');
    expect(watch.verdict).toBe('required');
  });

  it('keeps what it knew when the manifest cannot be read (offline)', async () => {
    const versions = aVersionSource({ web: { latest: 'v1.3.0', minimum: 'v1.3.0' } });
    const watch = new UpdateWatch(versions.source, RUNNING);
    await watch.check();

    versions.publish(null);
    await watch.check();

    expect(watch.verdict).toBe('required');
  });

  it('locks an open vault fully once the floor rises above this build', async () => {
    const device = aDevice();
    const store = device.startStore();
    store.create('Family', TEST_PASSWORD);
    await when(() => store.lifecycle.kind === 'unlocked');
    const versions = aVersionSource({ web: { latest: 'v1.2.0', minimum: 'v1.0.0' } });
    const watch = new UpdateWatch(versions.source, RUNNING);
    const stop = lockWhenUpdateRequired(watch, store);

    await watch.check();
    const stillOpen = store.lifecycle.kind;
    versions.publish({ web: { latest: 'v2.0.0', minimum: 'v2.0.0' } });
    await watch.check();
    await when(() => store.lifecycle.kind === 'locked');
    stop();

    expect(stillOpen).toBe('unlocked');
    expect(store.lifecycle).toMatchObject({ level: 'full', reason: 'update-required' });
    expect(device.reloads()).toBe(1);
  });

  it('locks a vault opened after the floor rose: an old build never keeps one open', async () => {
    const device = aDevice();
    const store = device.startStore();
    const versions = aVersionSource({ web: { latest: 'v2.0.0', minimum: 'v2.0.0' } });
    const watch = new UpdateWatch(versions.source, RUNNING);
    await watch.check();
    const stop = lockWhenUpdateRequired(watch, store);

    store.create('Family', TEST_PASSWORD);
    await when(() => store.lifecycle.kind === 'locked');
    stop();

    expect(store.lifecycle).toMatchObject({ level: 'full', reason: 'update-required' });
  });
});
