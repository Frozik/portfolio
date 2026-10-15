import type { IImageCompressor } from '@frozik/vault-app/document/domain/ports/image-compressor';

const MAX_SIDE_PX = 2000;
const JPEG_QUALITY = 0.8;
const JPEG = 'image/jpeg';
/** Vector and animated images lose what makes them so as a JPEG; they stay as they are. */
const KEPT_AS_IS = new Set(['image/svg+xml', 'image/gif']);

/** JPEG has no transparency: what was see-through becomes white, as on paper, not black. */
const TRANSPARENT_BECOMES = '#ffffff';

/**
 * Redraws a photo at most 2000 px on its long side as JPEG
 * q 0.8. Safari cannot encode WebP, so JPEG is what every browser writes.
 * Always redrawn, even when not smaller: the camera's metadata (where a
 * photo was taken) does not survive a redraw, and must not reach the vault.
 */
export const CANVAS_IMAGE_COMPRESSOR: IImageCompressor = {
  async compress(bytes, mime) {
    if (!mime.startsWith('image/') || KEPT_AS_IS.has(mime)) {
      return null;
    }
    const bitmap = await createImageBitmap(new Blob([bytes], { type: mime })).catch(() => null);
    if (bitmap === null) {
      return null;
    }
    const scale = Math.min(1, MAX_SIDE_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = new OffscreenCanvas(
      Math.round(bitmap.width * scale),
      Math.round(bitmap.height * scale)
    );
    const context = canvas.getContext('2d');
    if (context !== null) {
      context.fillStyle = TRANSPARENT_BECOMES;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    }
    bitmap.close();
    const blob = await canvas.convertToBlob({ type: JPEG, quality: JPEG_QUALITY });
    if (blob.type !== JPEG) {
      return null;
    }
    return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: JPEG };
  },
};
