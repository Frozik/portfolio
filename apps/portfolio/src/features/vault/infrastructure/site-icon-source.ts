import { isNil } from 'lodash-es';

import type { TFetchSiteIcon } from '../domain/ports/site-icons';

const ICON_SIDE = 64;
/** The two services that answer a page of another origin (CORS); the second when the first fails. */
const SOURCES: readonly ((domain: string) => string)[] = [
  domain => `https://icon.horse/icon/${encodeURIComponent(domain)}`,
  domain => `https://favicone.com/${encodeURIComponent(domain)}?s=${ICON_SIDE}`,
];

/** The picture fitted into 64×64, as PNG: what the vault keeps whatever the site served. */
async function normalized(blob: Blob): Promise<Uint8Array<ArrayBuffer> | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(ICON_SIDE / bitmap.width, ICON_SIDE / bitmap.height, 1);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = new OffscreenCanvas(ICON_SIDE, ICON_SIDE);
    canvas
      .getContext('2d')
      ?.drawImage(bitmap, (ICON_SIDE - width) / 2, (ICON_SIDE - height) / 2, width, height);
    bitmap.close();
    const png = await canvas.convertToBlob({ type: 'image/png' });
    return new Uint8Array(await png.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * A site's icon from icon.horse, else favicone.com. A service
 * that answered without a picture means the site has none; no answer at all
 * (offline, blocked) is asked again later, never stored as "none".
 */
export const fetchSiteIcon: TFetchSiteIcon = async (domain, signal) => {
  let answered = false;
  for (const source of SOURCES) {
    try {
      const response = await fetch(source(domain), {
        signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      answered = true;
      if (response.ok && (response.headers.get('content-type') ?? '').startsWith('image/')) {
        const png = await normalized(await response.blob());
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
