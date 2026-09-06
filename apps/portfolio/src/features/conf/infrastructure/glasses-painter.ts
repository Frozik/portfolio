import { GLASSES_BASE_WIDTH_PX } from '../domain/constants';
import type { GlassesAssetUrls, TGlassesStyle } from '../domain/glasses-style';
import type { IGlassesTransform } from '../domain/glasses-transform';

const GLASSES_INTRINSIC_WIDTH_PX = GLASSES_BASE_WIDTH_PX;
/**
 * Fallback intrinsic dimensions for an image whose `naturalWidth` /
 * `naturalHeight` are unavailable. Every bundled SVG declares explicit
 * `width` / `height` attributes, so this should not trigger in practice.
 */
const FALLBACK_INTRINSIC_HEIGHT_PX = 80;
const GLASSES_SIZE_MULTIPLIER = 2;
const GLASSES_DRAW_WIDTH_PX = GLASSES_INTRINSIC_WIDTH_PX * GLASSES_SIZE_MULTIPLIER;
const RAD_PER_DEG = Math.PI / 180;

export type GlassesImages = Readonly<Record<Exclude<TGlassesStyle, 'none'>, HTMLImageElement>>;

/**
 * Every non-`none` style's SVG, loaded up-front so flipping the picker is a
 * no-op in the paint loop. `decode()` failures are non-fatal — `drawImage`
 * still works against a loaded (but undecoded) image as long as the root SVG
 * declares explicit width/height.
 */
export async function loadGlassesImages(assetUrls: GlassesAssetUrls): Promise<GlassesImages> {
  const load = (url: string): HTMLImageElement => {
    const image = new Image();
    image.src = url;
    return image;
  };
  const images: GlassesImages = {
    round: load(assetUrls.round),
    hippie: load(assetUrls.hippie),
    teacher: load(assetUrls.teacher),
  };
  await Promise.all(Object.values(images).map(image => image.decode().catch(() => undefined)));
  return images;
}

/**
 * Paints the sprite under the affine transform the eye corners gave. Each
 * style's SVG declares its own intrinsic aspect: round and teacher are 240×80
 * (3:1) but hippie is 240×160 (3:2) so the 2×-larger stars fit without
 * clipping. Deriving the height from `naturalHeight / naturalWidth` keeps lens
 * centres on the pupil line for every style without per-style branching.
 */
export function paintGlasses(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  transform: IGlassesTransform
): void {
  const naturalWidth = image.naturalWidth > 0 ? image.naturalWidth : GLASSES_INTRINSIC_WIDTH_PX;
  const naturalHeight =
    image.naturalHeight > 0 ? image.naturalHeight : FALLBACK_INTRINSIC_HEIGHT_PX;
  const drawHeight = (GLASSES_DRAW_WIDTH_PX * naturalHeight) / naturalWidth;
  context.save();
  context.translate(transform.translateX, transform.translateY);
  context.rotate(transform.rotateDeg * RAD_PER_DEG);
  context.scale(transform.scaleX, transform.scaleY);
  context.drawImage(
    image,
    -GLASSES_DRAW_WIDTH_PX / 2,
    -drawHeight / 2,
    GLASSES_DRAW_WIDTH_PX,
    drawHeight
  );
  context.restore();
}
