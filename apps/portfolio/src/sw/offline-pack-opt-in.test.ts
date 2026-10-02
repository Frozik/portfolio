import type { TOptInCache } from './offline-pack-opt-in';
import { OfflinePackOptIn } from './offline-pack-opt-in';

const MARKER = 'https://example.test/portfolio/offline-pack';

function fakeCache(): TOptInCache {
  const stored = new Map<string, Response>();
  return {
    match: info => Promise.resolve(stored.get(String(info))),
    put: (info, response) => {
      stored.set(String(info), response);
      return Promise.resolve();
    },
  };
}

describe('OfflinePackOptIn', () => {
  it('is not remembered until the pack was asked for', async () => {
    const optIn = new OfflinePackOptIn(MARKER, () => Promise.resolve(fakeCache()));
    expect(await optIn.isRemembered()).toBe(false);
  });

  it('stays remembered for the next worker reading the same cache', async () => {
    const cache = fakeCache();
    await new OfflinePackOptIn(MARKER, () => Promise.resolve(cache)).remember();
    const nextBuild = new OfflinePackOptIn(MARKER, () => Promise.resolve(cache));
    expect(await nextBuild.isRemembered()).toBe(true);
  });
});
