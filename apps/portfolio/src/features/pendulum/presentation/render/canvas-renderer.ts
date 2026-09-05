import { isNil } from 'lodash-es';

import type { IPoint, IRenderer, IWorld } from '../../domain/types';
import { drawForce } from './draw-force';
import { drawPendulum } from './draw-pendulum';
import { drawRails } from './draw-rails';

export interface IPlaygroundCanvases {
  readonly staticContext: CanvasRenderingContext2D;
  readonly context: CanvasRenderingContext2D;
}

function withCenteredOrigin(
  context: CanvasRenderingContext2D,
  paint: (context: CanvasRenderingContext2D) => void
): void {
  const { width, height } = context.canvas;

  context.clearRect(0, 0, width, height);
  context.save();
  context.translate(width / 2, height / 2);
  paint(context);
  context.restore();
}

/** Paints the rails on the static canvas and the moving worlds on the one above it. */
export function createCanvasRenderer({ staticContext, context }: IPlaygroundCanvases): IRenderer {
  return {
    renderStatic(): void {
      withCenteredOrigin(staticContext, drawRails);
    },
    render(worlds: readonly IWorld[], pointerForce: IPoint | undefined): void {
      withCenteredOrigin(context, target => {
        for (const world of worlds) {
          drawPendulum(target, world);
        }
        if (!isNil(pointerForce)) {
          drawForce(target, pointerForce);
        }
      });
    },
  };
}
