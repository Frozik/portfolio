import { fromBase64 } from '@frozik/vault/crypto/bytes';

import { FAVICONE_BLANK_PAGE_BASE64 } from './favicone-blank-page.fixture';
import { BROWSER_ICON_SEARCH, PHONE_ICON_SEARCH, siteIconFetcher } from './site-icon-fetcher';

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

    const fetched = await siteIconFetcher(normalize, BROWSER_ICON_SEARCH).fetch(
      'github.com',
      SIGNAL
    );

    expect({ fetched, given: normalize.mock.calls[0] }).toEqual({
      fetched: { kind: 'icon', png: PNG },
      given: [PICTURE, 'image/x-icon'],
    });
  });

  it('asks the second service when the first cannot be reached', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(picture());

    expect(
      await siteIconFetcher(() => Promise.resolve(PNG), BROWSER_ICON_SEARCH).fetch(
        'github.com',
        SIGNAL
      )
    ).toEqual({
      kind: 'icon',
      png: PNG,
    });
  });

  it('passes over a letter the first service draws for a site it could not reach, for the next one’s real icon', async () => {
    const letter = new Response(Uint8Array.of(7), {
      headers: { 'content-type': 'image/png', 'x-icon-fallback': 'true' },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(letter).mockResolvedValueOnce(picture());
    const normalize = vi.fn().mockResolvedValue(PNG);

    const fetched = await siteIconFetcher(normalize, BROWSER_ICON_SEARCH).fetch(
      'binance.com',
      SIGNAL
    );

    expect({ fetched, given: normalize.mock.calls.map(([bytes]) => [...bytes]) }).toEqual({
      fetched: { kind: 'icon', png: PNG },
      given: [[...PICTURE]],
    });
  });

  it('takes neither service’s stand-in for an icon: the site has none', async () => {
    const letter = new Response(Uint8Array.of(7), {
      headers: { 'content-type': 'image/png', 'x-icon-fallback': 'true' },
    });
    const blankPage = new Response(fromBase64(FAVICONE_BLANK_PAGE_BASE64) ?? new Uint8Array(0), {
      headers: { 'content-type': 'image/x-icon' },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(letter).mockResolvedValueOnce(blankPage);
    const normalize = vi.fn().mockResolvedValue(PNG);

    expect({
      fetched: await siteIconFetcher(normalize, BROWSER_ICON_SEARCH).fetch('ozon.ru', SIGNAL),
      normalized: normalize.mock.calls.length,
    }).toEqual({ fetched: { kind: 'none' }, normalized: 0 });
  });

  it('says the site has none when the services answered without a picture it can read', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(page()).mockResolvedValueOnce(picture());

    expect(
      await siteIconFetcher(() => Promise.resolve(null), BROWSER_ICON_SEARCH).fetch(
        'noicon.example',
        SIGNAL
      )
    ).toEqual({
      kind: 'none',
    });
  });

  it('asks again later when no service answered at all', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));

    expect(
      await siteIconFetcher(() => Promise.resolve(PNG), BROWSER_ICON_SEARCH).fetch(
        'github.com',
        SIGNAL
      )
    ).toEqual({
      kind: 'failed',
    });
  });

  it('on a phone, takes the home-screen icon the site’s own page names when both services have none', async () => {
    const letter = new Response(Uint8Array.of(7), {
      headers: { 'content-type': 'image/png', 'x-icon-fallback': 'true' },
    });
    const sitePage = new Response(
      '<link rel="apple-touch-icon" href="/touch.png"><link rel="icon" href="/favicon.svg">',
      { headers: { 'content-type': 'text/html' } }
    );
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(letter)
      .mockResolvedValueOnce(page())
      .mockResolvedValueOnce(sitePage)
      .mockResolvedValueOnce(picture());

    const fetched = await siteIconFetcher(() => Promise.resolve(PNG), PHONE_ICON_SEARCH).fetch(
      'www.colins.ru',
      SIGNAL
    );

    expect({ fetched, asked: fetch.mock.calls.slice(2).map(([url]) => String(url)) }).toEqual({
      fetched: { kind: 'icon', png: PNG },
      asked: ['https://www.colins.ru/', 'https://www.colins.ru/touch.png'],
    });
  });

  it('on a phone, asks Google last, when the site’s page offers nothing it can draw', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(page())
      .mockResolvedValueOnce(page())
      .mockResolvedValueOnce(new Response('', { status: 403 }))
      .mockResolvedValueOnce(picture());

    const fetched = await siteIconFetcher(() => Promise.resolve(PNG), PHONE_ICON_SEARCH).fetch(
      'www.alfabank.by',
      SIGNAL
    );

    expect({ fetched, last: String(fetch.mock.calls.at(-1)?.[0]) }).toEqual({
      fetched: { kind: 'icon', png: PNG },
      last: expect.stringMatching(
        /^https:\/\/www\.google\.com\/s2\/favicons\?domain=www\.alfabank\.by/
      ),
    });
  });
});
