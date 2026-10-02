import { isNil } from 'lodash-es';

/** A finger resting this long on the chart drives the crosshair instead of panning. */
const HOLD_DELAY_MS = 300;
/** A finger that travels further than this before the delay is panning, not holding. */
const HOLD_SLOP_PX = 8;

export interface IHoldPosition {
  readonly x: number;
  readonly y: number;
}

/**
 * A finger resting on the chart for a moment: `onHold` fires once, and
 * `onRelease` when the finger lifts. Travelling beyond the slop before the
 * delay, or a second finger, makes the gesture a pan or a pinch instead.
 */
export class TouchHold {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private origin: IHoldPosition | undefined;
  private holding = false;

  constructor(
    private readonly onHold: (position: IHoldPosition) => void,
    private readonly onRelease: () => void
  ) {}

  get isHolding(): boolean {
    return this.holding;
  }

  begin(position: IHoldPosition): void {
    this.end();
    this.origin = position;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.holding = true;
      this.onHold(position);
    }, HOLD_DELAY_MS);
  }

  /** `true` while the move belongs to the hold (resting before the delay, or holding) and must not pan. */
  move(position: IHoldPosition): boolean {
    if (this.holding) {
      return true;
    }
    if (isNil(this.origin)) {
      return false;
    }
    if (Math.hypot(position.x - this.origin.x, position.y - this.origin.y) > HOLD_SLOP_PX) {
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
