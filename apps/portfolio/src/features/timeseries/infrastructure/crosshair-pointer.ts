import type { FpsController } from '@frozik/utils/webgpu/fpsController';

import { FPS_INTERACTION } from '../domain/constants';
import type { IPointerPosition } from '../domain/crosshair';

const TOUCH_POINTER = 'touch';

/**
 * Where the pointer is over the chart canvas. A mouse or pen hovers; a
 * finger pans and pinches, so it drives the crosshair only while the chart
 * input holds it (`holdAt` … `release`).
 */
export class CrosshairPointer {
  private currentPosition: IPointerPosition | undefined;
  private touchHeld = false;

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

  holdAt(position: IPointerPosition): void {
    this.touchHeld = true;
    this.currentPosition = position;
    this.fpsController.raise(FPS_INTERACTION);
  }

  release(): void {
    this.touchHeld = false;
    this.currentPosition = undefined;
    this.fpsController.raise(FPS_INTERACTION);
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const follows = event.pointerType !== TOUCH_POINTER || this.touchHeld;
    this.currentPosition = follows ? { x: event.offsetX, y: event.offsetY } : undefined;
    this.fpsController.raise(FPS_INTERACTION);
  };

  private readonly handlePointerGone = (): void => {
    this.touchHeld = false;
    this.currentPosition = undefined;
    this.fpsController.raise(FPS_INTERACTION);
  };
}
