import { isNil } from 'lodash-es';

import type { TOfflinePackStatus } from './offline-pack-protocol';

export type TAssetCache = Pick<Cache, 'keys' | 'add' | 'delete'>;

const DOWNLOAD_CONCURRENCY = 4;

/**
 * The hashed assets a build ships beyond its precached shell, downloaded into
 * the runtime asset cache on request so every route opens without a network.
 * Downloading is idempotent and resumable: only the files missing from the
 * cache are fetched, and a second request while one runs joins it.
 */
export class OfflinePack {
  private warming: Promise<void> | null = null;

  constructor(
    private readonly urls: ReadonlySet<string>,
    private readonly openCache: () => Promise<TAssetCache>,
    private readonly publish: (status: TOfflinePackStatus) => Promise<void>
  ) {}

  async status(): Promise<TOfflinePackStatus> {
    if (!isNil(this.warming)) {
      return { state: 'downloading', cached: await this.cachedCount(), total: this.urls.size };
    }
    return this.settledStatus(await this.cachedCount());
  }

  warm(): Promise<void> {
    this.warming ??= this.download().finally(() => {
      this.warming = null;
    });
    return this.warming;
  }

  /** Assets of other builds stay in the cache forever otherwise — one deployment's worth per release. */
  async dropForeignAssets(): Promise<void> {
    const cache = await this.openCache();
    const foreign = (await cache.keys()).filter(request => !this.urls.has(request.url));
    await Promise.all(foreign.map(request => cache.delete(request)));
  }

  private async download(): Promise<void> {
    const cache = await this.openCache();
    const cachedUrls = new Set((await cache.keys()).map(request => request.url));
    const queue = [...this.urls].filter(url => !cachedUrls.has(url));
    let cached = this.urls.size - queue.length;
    await this.publish({ state: 'downloading', cached, total: this.urls.size });

    const drain = async (): Promise<void> => {
      for (let url = queue.shift(); url !== undefined; url = queue.shift()) {
        await cache.add(url);
        cached += 1;
        await this.publish({ state: 'downloading', cached, total: this.urls.size });
      }
    };

    // A failed lane stops; the others keep going, so one bad file costs one file, not the pack.
    const lanes = await Promise.allSettled(Array.from({ length: DOWNLOAD_CONCURRENCY }, drain));
    await this.publish(
      lanes.some(lane => lane.status === 'rejected')
        ? { state: 'failed', cached, total: this.urls.size }
        : this.settledStatus(cached)
    );
  }

  private async cachedCount(): Promise<number> {
    const cache = await this.openCache();
    return (await cache.keys()).filter(request => this.urls.has(request.url)).length;
  }

  private settledStatus(cached: number): TOfflinePackStatus {
    return cached >= this.urls.size
      ? { state: 'ready', total: this.urls.size }
      : { state: 'incomplete', cached, total: this.urls.size };
  }
}
