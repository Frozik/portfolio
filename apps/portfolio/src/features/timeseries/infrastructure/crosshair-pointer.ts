import type { FpsController } from '@frozik/utils/webgpu/fpsController';

import { FPS_INTERACTION } from '../domain/constants';
import type { IPointerPosition } from '../domain/crosshair';

const TOUCH_POINTER = 'touch';

/**
 * Where the mouse or pen hovers over the chart canvas. A finger has no hover:
 * it pans and pinches, so touch pointers never show a crosshair.
 */
export class CrosshairPointer {
  private currentPosition: IPointerPosition | undefined;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly fpsController: FpsController
  ) {}

  get position(): IPointerPosition | undefined {
    return this.currentPosition;
  }

  attach(): void {
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerdown', this.handlePointerMove);
    this.canvas.addEventListener('pointerleave', this.handlePointerGone);
    this.canvas.addEventListener('pointercancel', this.handlePointerGone);
  }

  detach(): void {
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerdown', this.handlePointerMove);
    this.canvas.removeEventListener('pointerleave', this.handlePointerGone);
    this.canvas.removeEventListener('pointercancel', this.handlePointerGone);
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    this.currentPosition =
      event.pointerType === TOUCH_POINTER ? undefined : { x: event.offsetX, y: event.offsetY };
    this.fpsController.raise(FPS_INTERACTION);
  };

  private readonly handlePointerGone = (): void => {
    this.currentPosition = undefined;
    this.fpsController.raise(FPS_INTERACTION);
  };
}
