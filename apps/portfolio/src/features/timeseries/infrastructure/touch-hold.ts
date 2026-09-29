import { isNil } from 'lodash-es';

import { TOUCH_HOLD_DELAY_MS, TOUCH_HOLD_SLOP_PX } from '../domain/constants';
import type { IPointerPosition } from '../domain/crosshair';

/**
 * A finger resting on the chart for a moment: `onHold` fires once, and
 * `onRelease` when the finger lifts. Travelling beyond the slop before the
 * delay, or a second finger, makes the gesture a pan or a pinch instead.
 */
export class TouchHold {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private origin: IPointerPosition | undefined;
  private holding = false;

  constructor(
    private readonly onHold: (position: IPointerPosition) => void,
    private readonly onRelease: () => void
  ) {}

  get isHolding(): boolean {
    return this.holding;
  }

  begin(position: IPointerPosition): void {
    this.end();
    this.origin = position;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.holding = true;
      this.onHold(position);
    }, TOUCH_HOLD_DELAY_MS);
  }

  /** `true` while the move belongs to the hold (resting before the delay, or holding) and must not pan. */
  move(position: IPointerPosition): boolean {
    if (this.holding) {
      return true;
    }
    if (isNil(this.origin)) {
      return false;
    }
    if (Math.hypot(position.x - this.origin.x, position.y - this.origin.y) > TOUCH_HOLD_SLOP_PX) {
      this.cancel();
      return false;
    }
    return true;
  }

  end(): void {
    const wasHolding = this.holding;
    this.cancel();
    if (wasHolding) {
      this.onRelease();
    }
  }

  private cancel(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.origin = undefined;
    this.holding = false;
  }
}
