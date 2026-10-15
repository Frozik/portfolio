import { Temporal } from 'temporal-polyfill';

import { memoryDirectoryCache, twoFactorDirectoryLoader } from './two-factor-directory';

const SIGNAL = new AbortController().signal;
const DIRECTORY = [['Example', { domain: 'example.com', tfa: ['totp'] }]];
const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;

describe('the 2FA Directory loader', () => {
  afterEach(() => vi.restoreAllMocks());

  it('asks the directory once a week, not on every audit', async () => {
    const fetching = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(DIRECTORY));
    const load = twoFactorDirectoryLoader(memoryDirectoryCache());

    const domains = await load(SIGNAL);
    await load(SIGNAL);

    expect({ domains: [...(domains ?? [])], fetches: fetching.mock.calls.length }).toEqual({
      domains: ['example.com'],
      fetches: 1,
    });
  });

  it('falls back to the copy it has when the directory cannot be reached', async () => {
    const cache = memoryDirectoryCache();
    await cache.write({
      fetchedAtMs: Temporal.Now.instant().epochMilliseconds - EIGHT_DAYS_MS,
      json: DIRECTORY,
    });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));

    expect([...((await twoFactorDirectoryLoader(cache)(SIGNAL)) ?? [])]).toEqual(['example.com']);
  });

  it('gives nothing when there is neither a copy nor an answer', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));

    expect(await twoFactorDirectoryLoader(memoryDirectoryCache())(SIGNAL)).toBeNull();
  });
});
