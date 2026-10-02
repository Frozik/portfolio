import type { IAxisDomain, IAxisRange } from './axis-domain';
import { isSameRange, shiftRange } from './axis-domain';

/** `current` is what is drawn; `target` is where an animation is heading. */
export interface IViewportState<TX> {
  readonly current: IAxisRange<TX>;
  readonly target: IAxisRange<TX>;
}

export interface IViewportOptions<TX> {
  readonly domain: IAxisDomain<TX>;
  readonly x: IAxisRange<TX>;
  /** Applied to every X range written through the public commands. */
  readonly constrain: (range: IAxisRange<TX>) => IAxisRange<TX>;
  readonly onChange: VoidFunction;
}

/** The one writable home of a chart's visible range along X; readers get immutable snapshots. */
export class Viewport<TX> {
  private state: IViewportState<TX>;
  private changes = 0;

  constructor(private readonly options: IViewportOptions<TX>) {
    this.state = { current: options.x, target: options.x };
  }

  get current(): IAxisRange<TX> {
    return this.state.current;
  }

  get target(): IAxisRange<TX> {
    return this.state.target;
  }

  /** Grows with every change: a frame built for one revision stays valid until the next. */
  get revision(): number {
    return this.changes;
  }

  setTarget(range: IAxisRange<TX>): void {
    this.write({ ...this.state, target: this.options.constrain(range) });
  }

  jump(range: IAxisRange<TX>): void {
    const constrained = this.options.constrain(range);
    this.write({ ...this.state, current: constrained, target: constrained });
  }

  /**
   * Moves what is drawn by `delta` and the target by as much as the drawn range
   * really moved, so an animation in flight keeps its gap. Returns the distance moved.
   */
  shift(delta: number): number {
    const { domain, constrain } = this.options;
    const { current, target } = this.state;
    const next = constrain(shiftRange(domain, current, delta));
    const moved = domain.diff(next.start, current.start);
    this.write({ ...this.state, current: next, target: shiftRange(domain, target, moved) });
    return moved;
  }

  /** For animators: moves what is drawn without touching the target or the constraints. */
  setCurrent(range: IAxisRange<TX>): void {
    this.write({ ...this.state, current: range });
  }

  private write(next: IViewportState<TX>): void {
    const { domain } = this.options;
    const previous = this.state;
    if (
      isSameRange(domain, previous.current, next.current) &&
      isSameRange(domain, previous.target, next.target)
    ) {
      return;
    }
    this.state = next;
    this.changes += 1;
    this.options.onChange();
  }
}
