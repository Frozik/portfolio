import { SITE_ICON_SIDE, siteIconFetcher } from '@frozik/vault-http/document/site-icon-fetcher';

/** The picture fitted into the icon's square, as PNG: what the vault keeps whatever the site served. */
async function onCanvas(
  picture: Uint8Array<ArrayBuffer>,
  mime: string
): Promise<Uint8Array<ArrayBuffer> | null> {
  try {
    const bitmap = await createImageBitmap(new Blob([picture], { type: mime }));
    const scale = Math.min(SITE_ICON_SIDE / bitmap.width, SITE_ICON_SIDE / bitmap.height, 1);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = new OffscreenCanvas(SITE_ICON_SIDE, SITE_ICON_SIDE);
    canvas
      .getContext('2d')
      ?.drawImage(
        bitmap,
        (SITE_ICON_SIDE - width) / 2,
        (SITE_ICON_SIDE - height) / 2,
        width,
        height
      );
    bitmap.close();
    const png = await canvas.convertToBlob({ type: 'image/png' });
    return new Uint8Array(await png.arrayBuffer());
  } catch {
    return null;
  }
}

export const fetchSiteIcon = siteIconFetcher(onCanvas);
