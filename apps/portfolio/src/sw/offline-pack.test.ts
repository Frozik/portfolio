import type { TAssetCache } from './offline-pack';
import { OfflinePack } from './offline-pack';
import type { TOfflinePackStatus } from './offline-pack-protocol';

const ORIGIN = 'https://example.test/portfolio/';
const url = (name: string): string => `${ORIGIN}assets/${name}`;

function requestUrl(info: RequestInfo | URL): string {
  return typeof info === 'string' ? info : info instanceof URL ? info.href : info.url;
}

function fakeCache(initial: readonly string[], failing: ReadonlySet<string> = new Set()) {
  const stored = new Set(initial);
  const cache: TAssetCache = {
    keys: () => Promise.resolve([...stored].map(cached => new Request(cached))),
    add: info => {
      const target = requestUrl(info);
      if (failing.has(target)) {
        return Promise.reject(new TypeError('Failed to fetch'));
      }
      stored.add(target);
      return Promise.resolve();
    },
    delete: info => Promise.resolve(stored.delete(requestUrl(info))),
  };
  return { cache, stored };
}

function createPack(
  urls: readonly string[],
  cache: TAssetCache
): { pack: OfflinePack; published: TOfflinePackStatus[] } {
  const published: TOfflinePackStatus[] = [];
  const pack = new OfflinePack(
    new Set(urls),
    () => Promise.resolve(cache),
    status => {
      published.push(status);
      return Promise.resolve();
    }
  );
  return { pack, published };
}

describe('OfflinePack', () => {
  const PACK = [url('a.js'), url('b.js'), url('c.css')];

  it('reports an empty cache as incomplete and a full one as ready', async () => {
    const empty = createPack(PACK, fakeCache([]).cache);
    expect(await empty.pack.status()).toEqual({ state: 'incomplete', cached: 0, total: 3 });

    const full = createPack(PACK, fakeCache(PACK).cache);
    expect(await full.pack.status()).toEqual({ state: 'ready', total: 3 });
  });

  it('downloads only the files missing from the cache and ends ready', async () => {
    const { cache, stored } = fakeCache([url('a.js')]);
    const { pack, published } = createPack(PACK, cache);

    await pack.warm();

    expect([...stored].toSorted()).toEqual(PACK.toSorted());
    expect(published[0]).toEqual({ state: 'downloading', cached: 1, total: 3 });
    expect(published.at(-1)).toEqual({ state: 'ready', total: 3 });
  });

  it('publishes progress after every downloaded file', async () => {
    const { pack, published } = createPack(PACK, fakeCache([]).cache);

    await pack.warm();

    const progress = published
      .filter(status => status.state === 'downloading')
      .map(status => status.cached);
    expect(progress).toEqual([0, 1, 2, 3]);
  });

  it('keeps downloading the other files when one fails and reports the failure last', async () => {
    const { cache, stored } = fakeCache([], new Set([url('b.js')]));
    const { pack, published } = createPack(PACK, cache);

    await pack.warm();

    expect([...stored].toSorted()).toEqual([url('a.js'), url('c.css')]);
    expect(published.at(-1)).toEqual({ state: 'failed', cached: 2, total: 3 });
  });

  it('joins a download already in progress instead of starting a second one', async () => {
    const { pack, published } = createPack(PACK, fakeCache([]).cache);

    await Promise.all([pack.warm(), pack.warm()]);

    expect(published.filter(status => status.state === 'ready')).toHaveLength(1);
  });

  it('reports downloading while a warm-up runs', async () => {
    const { pack } = createPack(PACK, fakeCache([]).cache);

    const warming = pack.warm();
    const during = await pack.status();
    await warming;

    expect(during.state).toBe('downloading');
    expect((await pack.status()).state).toBe('ready');
  });

  it('drops cached assets that are not part of this build', async () => {
    const stale = `${ORIGIN}assets/old-build.js`;
    const { cache, stored } = fakeCache([url('a.js'), stale]);
    const { pack } = createPack(PACK, cache);

    await pack.dropForeignAssets();

    expect([...stored]).toEqual([url('a.js')]);
  });
});
