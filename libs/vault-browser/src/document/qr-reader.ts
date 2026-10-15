import { isNil } from 'lodash-es';

import type { TReadQrCode } from '@frozik/vault-app/document/domain/ports/qr-reader';
import type { IRgbaPixels } from './qr-pixels';
import { readablePixels } from './qr-pixels';

/** The browser's own detector, where there is one: native and fast. */
async function detected(pixels: IRgbaPixels): Promise<string | null> {
  if (!('BarcodeDetector' in globalThis)) {
    return null;
  }
  const image = new ImageData(pixels.data, pixels.width, pixels.height);
  const [code] = await new BarcodeDetector({ formats: ['qr_code'] }).detect(image).catch(() => []);
  return code?.rawValue ?? null;
}

/** jsQR (Apache-2.0, plain JS, loaded only now) reads the pixels everywhere else. */
async function scanned(pixels: IRgbaPixels): Promise<string | null> {
  const { default: jsQR } = await import('jsqr');
  return jsQR(pixels.data, pixels.width, pixels.height)?.data ?? null;
}

function pixelsOf(bitmap: ImageBitmap): IRgbaPixels | null {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d');
  if (isNil(context)) {
    return null;
  }
  context.drawImage(bitmap, 0, 0);
  const { data, width, height } = context.getImageData(0, 0, bitmap.width, bitmap.height);
  return { data, width, height };
}

/**
 * A QR code from a screenshot or a photo: `BarcodeDetector`
 * as the quick path, jsQR otherwise, both on the picture laid on white with
 * a border (a transparent PNG or a tight crop is otherwise read as nothing).
 * The picture stays in the page.
 */
export const readQrCode: TReadQrCode = async ({ bytes, mime }) => {
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mime })).catch(() => null);
  if (isNil(bitmap)) {
    return null;
  }
  try {
    const source = pixelsOf(bitmap);
    if (isNil(source)) {
      return null;
    }
    const pixels = readablePixels(source);
    return (await detected(pixels)) ?? (await scanned(pixels));
  } finally {
    bitmap.close();
  }
};
