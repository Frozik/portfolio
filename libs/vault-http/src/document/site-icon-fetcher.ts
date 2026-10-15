import { isNil } from 'lodash-es';

import type { TFetchSiteIcon } from '@frozik/vault-app/document/domain/ports/site-icons';

export const SITE_ICON_SIDE = 64;

/** The picture a service served, fitted into a `SITE_ICON_SIDE` square PNG; `null` when it cannot be read. */
export type TNormalizeSiteIcon = (
  picture: Uint8Array<ArrayBuffer>,
  mime: string
) => Promise<Uint8Array<ArrayBuffer> | null>;

/** The two services that answer a page of another origin (CORS); the second when the first fails. */
const SOURCES: readonly ((domain: string) => string)[] = [
  domain => `https://icon.horse/icon/${encodeURIComponent(domain)}`,
  domain => `https://favicone.com/${encodeURIComponent(domain)}?s=${SITE_ICON_SIDE}`,
];

/**
 * A site's icon from icon.horse, else favicone.com, made a PNG by the platform's own pictures. A
 * service that answered without a picture means the site has none; no answer at all (offline,
 * blocked) is asked again later, never stored as "none".
 */
export function siteIconFetcher(normalize: TNormalizeSiteIcon): TFetchSiteIcon {
  return async (domain, signal) => {
    let answered = false;
    for (const source of SOURCES) {
      try {
        const response = await fetch(source(domain), {
          signal,
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        });
        answered = true;
        const mime = response.headers.get('content-type') ?? '';
        if (response.ok && mime.startsWith('image/')) {
          const png = await normalize(new Uint8Array(await response.arrayBuffer()), mime);
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
}
