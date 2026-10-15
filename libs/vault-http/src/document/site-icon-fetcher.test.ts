import { siteIconFetcher } from './site-icon-fetcher';

const SIGNAL = new AbortController().signal;
const PICTURE = Uint8Array.of(1, 2, 3);
const PNG = Uint8Array.of(9, 9);

const picture = () => new Response(PICTURE, { headers: { 'content-type': 'image/x-icon' } });
const page = () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } });

describe('fetching a site’s icon', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps the first service’s picture as the PNG the platform made of it', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(picture());
    const normalize = vi.fn().mockResolvedValue(PNG);

    const fetched = await siteIconFetcher(normalize)('github.com', SIGNAL);

    expect({ fetched, given: normalize.mock.calls[0] }).toEqual({
      fetched: { kind: 'icon', png: PNG },
      given: [PICTURE, 'image/x-icon'],
    });
  });

  it('asks the second service when the first cannot be reached', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(picture());

    expect(await siteIconFetcher(() => Promise.resolve(PNG))('github.com', SIGNAL)).toEqual({
      kind: 'icon',
      png: PNG,
    });
  });

  it('says the site has none when the services answered without a picture it can read', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(page()).mockResolvedValueOnce(picture());

    expect(await siteIconFetcher(() => Promise.resolve(null))('noicon.example', SIGNAL)).toEqual({
      kind: 'none',
    });
  });

  it('asks again later when no service answered at all', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));

    expect(await siteIconFetcher(() => Promise.resolve(PNG))('github.com', SIGNAL)).toEqual({
      kind: 'failed',
    });
  });
});
