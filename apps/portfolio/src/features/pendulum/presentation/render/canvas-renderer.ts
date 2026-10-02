import { isNil } from 'lodash-es';

import type { IPoint, IRenderer, IWorld } from '../../domain/types';
import { drawForce } from './draw-force';
import { drawPendulum } from './draw-pendulum';
import { drawRails } from './draw-rails';
import { sceneScale } from './scene-viewport';

export interface IPlaygroundCanvases {
  readonly staticContext: CanvasRenderingContext2D;
  readonly context: CanvasRenderingContext2D;
  /** Backing-store pixels per CSS pixel of both canvases. */
  readonly pixelRatio: number;
}

function withSceneTransform(
  context: CanvasRenderingContext2D,
  pixelRatio: number,
  paint: (context: CanvasRenderingContext2D) => void
): void {
  const { width, height } = context.canvas;
  const scale = sceneScale(width / pixelRatio, height / pixelRatio) * pixelRatio;

  context.clearRect(0, 0, width, height);
  context.save();
  context.translate(width / 2, height / 2);
  context.scale(scale, scale);
  paint(context);
  context.restore();
}

/** Paints the rails on the static canvas and the moving worlds on the one above it. */
export function createCanvasRenderer({
  staticContext,
  context,
  pixelRatio,
}: IPlaygroundCanvases): IRenderer {
  return {
    renderStatic(): void {
      withSceneTransform(staticContext, pixelRatio, drawRails);
    },
    render(worlds: readonly IWorld[], pointerPosition: IPoint | undefined): void {
      withSceneTransform(context, pixelRatio, target => {
        for (const world of worlds) {
          drawPendulum(target, world);
        }
        if (!isNil(pointerPosition)) {
          drawForce(target, pointerPosition);
        }
      });
    },
  };
}
