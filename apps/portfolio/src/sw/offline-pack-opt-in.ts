export type TOptInCache = Pick<Cache, 'match' | 'put'>;

/**
 * Remembers that this origin asked for the offline pack, so the next build's
 * worker downloads its own pack while installing — before activation deletes
 * the previous build's assets. A plain Cache entry is the one storage both
 * the worker and a fresh install can read without IndexedDB plumbing.
 */
export class OfflinePackOptIn {
  constructor(
    private readonly markerUrl: string,
    private readonly openCache: () => Promise<TOptInCache>
  ) {}

  async remember(): Promise<void> {
    const cache = await this.openCache();
    await cache.put(this.markerUrl, new Response(''));
  }

  async isRemembered(): Promise<boolean> {
    const cache = await this.openCache();
    return (await cache.match(this.markerUrl)) !== undefined;
  }
}
