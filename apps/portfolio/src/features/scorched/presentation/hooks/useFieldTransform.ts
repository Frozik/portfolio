import type { LetterboxTransform } from '@frozik/utils/webgpu/letterboxTransform';
import { isNil } from 'lodash-es';
import type { RefObject } from 'react';
import { useEffect, useState } from 'react';

import { FIELD_HEIGHT_WU, FIELD_WIDTH_WU } from '../../domain/constants';
import { computeViewTransform } from '../../infrastructure/view-transform';

const NO_TRANSFORM: LetterboxTransform = { scale: 0, originX: 0, originY: 0 };

/**
 * Where the letterboxed field currently sits inside the canvas, in CSS pixels. The GPU layers
 * compute the same transform in device pixels from the frame state; the React overlays need the
 * CSS-pixel version, and they are laid out by the browser rather than per frame — so this is a
 * resize-driven state rather than something recomputed on every tick.
 */
export function useFieldTransform(
  canvasRef: RefObject<HTMLCanvasElement | null>
): LetterboxTransform {
  const [transform, setTransform] = useState<LetterboxTransform>(NO_TRANSFORM);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (isNil(canvas) || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      setTransform(
        computeViewTransform(
          canvas.clientWidth,
          canvas.clientHeight,
          FIELD_WIDTH_WU,
          FIELD_HEIGHT_WU
        )
      );
    });

    observer.observe(canvas);

    return () => observer.disconnect();
  }, [canvasRef]);

  return transform;
}
