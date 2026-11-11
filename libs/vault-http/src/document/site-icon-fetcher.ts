import { sha256Hex } from '@frozik/vault/crypto/sha256';
import { isNil } from 'lodash-es';

import { NARROWEST_ICON_REACH } from '@frozik/vault/model/site-icons';

import type { ISiteIconFetcher } from '@frozik/vault-app/document/domain/ports/site-icons';

import { siteIconLinks } from './site-page-icons';

export const SITE_ICON_SIDE = 64;

/** The picture a service served, fitted into a `SITE_ICON_SIDE` square PNG; `null` when it cannot be read. */
export type TNormalizeSiteIcon = (
  picture: Uint8Array<ArrayBuffer>,
  mime: string
) => Promise<Uint8Array<ArrayBuffer> | null>;

interface IPicture {
  readonly picture: Uint8Array<ArrayBuffer>;
  readonly mime: string;
}

/**
 * Where a site's icon may come from: the pictures it offers, best first — none when it answered
 * without one. It throws when it could not be reached at all.
 */
type TIconSource = (domain: string, signal: AbortSignal) => Promise<readonly IPicture[]>;

const REQUEST = { credentials: 'omit', referrerPolicy: 'no-referrer' } as const;

async function pictureOf(response: Response): Promise<IPicture | null> {
  const mime = response.headers.get('content-type') ?? '';
  return response.ok && mime.startsWith('image/')
    ? { picture: new Uint8Array(await response.arrayBuffer()), mime }
    : null;
}

/** An icon service: one address per site, and a way to know the picture it draws for a site it could not find. */
function iconService(
  url: (domain: string) => string,
  isStandIn: (response: Response, picture: Uint8Array<ArrayBuffer>) => Promise<boolean>
): TIconSource {
  return async (domain, signal) => {
    const response = await fetch(url(domain), { signal, ...REQUEST });
    const found = await pictureOf(response);
    return isNil(found) || (await isStandIn(response, found.picture)) ? [] : [found];
  };
}

/**
 * favicone.com marks none of its stand-ins, so they are known by their bytes: a globe for a site
 * that does not exist, a blank page for one its servers could not reach (many `.ru` sites). Should
 * it draw others, the worst is a blank page where the template's icon would be.
 */
const FAVICONE_STAND_INS: ReadonlySet<string> = new Set([
  'ebfb7deb2782f551f757a9077203194dedeb132c091005204135905134e4b0e7',
  'b00f37dcea11e233bd5e8dbf437f6c794eb724eb7917f33c744c1c7de78f100e',
]);

const ICON_HORSE = iconService(
  domain => `https://icon.horse/icon/${encodeURIComponent(domain)}`,
  // It draws the site's first letter when it cannot reach the site, and says so in a header it exposes to other origins.
  response => Promise.resolve(response.headers.get('x-icon-fallback') === 'true')
);

const FAVICONE = iconService(
  domain => `https://favicone.com/${encodeURIComponent(domain)}?s=${SITE_ICON_SIDE}`,
  async (_response, picture) => FAVICONE_STAND_INS.has(await sha256Hex(picture))
);

/** Google answers an unknown site with 404, and serves no CORS header: a page cannot read it. */
const GOOGLE = iconService(
  domain =>
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${SITE_ICON_SIDE}`,
  () => Promise.resolve(false)
);

/** The icons the site's own page names, fetched from the site itself; a page cannot read another origin. */
const SITE_PAGE: TIconSource = async (domain, signal) => {
  const page = await fetch(`https://${domain}/`, { signal, ...REQUEST });
  if (!page.ok) {
    return [];
  }
  const links = siteIconLinks(await page.text(), page.url === '' ? `https://${domain}/` : page.url);
  const pictures: IPicture[] = [];
  for (const link of links) {
    try {
      const found = await pictureOf(await fetch(link, { signal, ...REQUEST }));
      if (!isNil(found)) {
        pictures.push(found);
      }
    } catch {
      if (signal.aborted) {
        throw signal.reason;
      }
    }
  }
  return pictures;
};

interface IIconSearch {
  readonly reach: number;
  readonly sources: readonly TIconSource[];
}

/** The two services that answer a page of another origin (CORS). */
export const BROWSER_ICON_SEARCH: IIconSearch = {
  reach: NARROWEST_ICON_REACH,
  sources: [ICON_HORSE, FAVICONE],
};

/** An app asks anyone: after the two services, the site's own page, then Google. */
export const PHONE_ICON_SEARCH: IIconSearch = {
  reach: NARROWEST_ICON_REACH + 1,
  sources: [ICON_HORSE, FAVICONE, SITE_PAGE, GOOGLE],
};

/**
 * A site's icon from the first source that has one, made a PNG by the platform's own pictures. A
 * source that answered without a picture — or with its stand-in for one — means the site has
 * none there; no answer at all (offline, blocked) is asked again later, never stored as "none".
 */
export function siteIconFetcher(
  normalize: TNormalizeSiteIcon,
  { reach, sources }: IIconSearch
): ISiteIconFetcher {
  const fetchIcon: ISiteIconFetcher['fetch'] = async (domain, signal) => {
    let answered = false;
    for (const source of sources) {
      try {
        const pictures = await source(domain, signal);
        answered = true;
        for (const { picture, mime } of pictures) {
          const png = await normalize(picture, mime);
          if (!isNil(png)) {
            return { kind: 'icon', png };
          }
        }
      } catch {
        if (signal.aborted) {
          return { kind: 'failed' };
        }
      }
    }
    return answered ? { kind: 'none' } : { kind: 'failed' };
  };
  return { reach, fetch: fetchIcon };
}
