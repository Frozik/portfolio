import { assert } from '@frozik/utils/assert/assert';

import type {
  IPaintContribution,
  IRenderBackend,
  ISurface,
  ISurfaceRole,
} from '../core/stage/backend';
import { CANVAS2D_BACKEND } from './painter';
import { Canvas2dSurface } from './surface';
import type { ITextMeasurer } from './text-measurer';
import { createTextMeasurer } from './text-measurer';

export interface ICanvas2dOptions {
  /** How text is measured; a memoising measurer over a canvas of its own by default. */
  readonly text?: ITextMeasurer;
}

/**
 * The 2D canvas as a backend: nothing shared between charts but the text
 * metrics. Above another backend it is a transparent overlay; alone, or at the
 * bottom of the stack, it draws the series too (§6.7).
 */
export function canvas2d(options: ICanvas2dOptions = {}): IRenderBackend {
  const text = options.text ?? createTextMeasurer();
  return {
    id: CANVAS2D_BACKEND,
    createSurface(
      canvas: unknown,
      contributions: readonly IPaintContribution[],
      role: ISurfaceRole
    ): ISurface {
      assert(canvas instanceof HTMLCanvasElement, 'the 2D backend draws into a canvas element');
      return new Canvas2dSurface(canvas, contributions, { text }, role.drawsSeries);
    },
    beginFrame(): void {},
    endFrame(): void {},
    dispose(): void {},
  };
}
