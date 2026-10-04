import { useEffect, useRef } from 'react';

import { drawShape } from '../capture/rasterize-annotation';
import type { IAnnotation } from '../core/annotation';

const THUMBNAIL_WIDTH = 320;
const THUMBNAIL_HEIGHT = 200;

/**
 * The screenshot with its marks drawn over it at thumbnail size — the
 * full-size flattening waits for the download, so the compose step opens
 * at once.
 */
export function ScreenshotThumbnail({
  image,
  annotation,
  alt,
}: {
  readonly image: Blob;
  readonly annotation: IAnnotation;
  readonly alt: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    void createImageBitmap(image).then(bitmap => {
      const context = canvas.current?.getContext('2d');
      if (cancelled || !context) {
        bitmap.close();
        return;
      }
      const scale = Math.max(THUMBNAIL_WIDTH / bitmap.width, THUMBNAIL_HEIGHT / bitmap.height);
      const offsetX = (THUMBNAIL_WIDTH - bitmap.width * scale) / 2;
      const offsetY = (THUMBNAIL_HEIGHT - bitmap.height * scale) / 2;
      context.clearRect(0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
      context.save();
      context.translate(offsetX, offsetY);
      context.scale(scale, scale);
      context.drawImage(bitmap, 0, 0);
      for (const shape of annotation.shapes) {
        drawShape(context, shape);
      }
      context.restore();
      bitmap.close();
    });
    return () => {
      cancelled = true;
    };
  }, [image, annotation]);

  return (
    <canvas
      ref={canvas}
      width={THUMBNAIL_WIDTH}
      height={THUMBNAIL_HEIGHT}
      className="bug-reporter-thumbnail"
      role="img"
      aria-label={alt}
    />
  );
}
