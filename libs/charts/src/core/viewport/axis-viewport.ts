import type { IAxisDomain, IAxisRange } from './axis-domain';
import { isSameRange, shiftRange } from './axis-domain';
import type { IAxisMapping } from './axis-mapping';

/** `current` is what is drawn; `target` is where an animation is heading. */
interface IAxisViewportState<T> {
  readonly current: IAxisRange<T>;
  readonly target: IAxisRange<T>;
  /** Set by hand: whatever fits the axis to the data leaves it alone until it is released. */
  readonly isHeld: boolean;
}

export interface IAxisViewportOptions<T> {
  readonly domain: IAxisDomain<T>;
  /** The correspondence between the world axis and the virtual one the viewport counts in; none, and they are the same. */
  readonly mapping?: IAxisMapping<T>;
  readonly initial: IAxisRange<T>;
  /** Applied to every range written through the public commands. */
  readonly constrain: (range: IAxisRange<T>) => IAxisRange<T>;
  readonly onChange: VoidFunction;
}

/**
 * The one writable home of the visible range along one axis — the X axis or
 * a value scale; readers get immutable snapshots. The policies that move it
 * (gestures, animators, bounds, autoscale) are extensions: the viewport
 * itself only keeps the range, the target and whether a hand holds it.
 */
export class AxisViewport<T> {
  private state: IAxisViewportState<T>;
  private changes = 0;
  private correspondence: IAxisMapping<T> | undefined;

  constructor(private readonly options: IAxisViewportOptions<T>) {
    const initial = options.constrain(options.initial);
    this.state = { current: initial, target: initial, isHeld: false };
    this.correspondence = options.mapping;
  }

  get domain(): IAxisDomain<T> {
    return this.options.domain;
  }

  /** How the virtual coordinate of the viewport relates to the world one; none while the axis is shown whole. */
  get mapping(): IAxisMapping<T> | undefined {
    return this.correspondence;
  }

  get current(): IAxisRange<T> {
    return this.state.current;
  }

  get target(): IAxisRange<T> {
    return this.state.target;
  }

  get isHeld(): boolean {
    return this.state.isHeld;
  }

  /** Grows with every change: a frame built for one revision stays valid until the next. */
  get revision(): number {
    return this.changes;
  }

  setTarget(range: IAxisRange<T>): void {
    this.write({ ...this.state, target: this.options.constrain(range) });
  }

  jump(range: IAxisRange<T>): void {
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
  setCurrent(range: IAxisRange<T>): void {
    this.write({ ...this.state, current: range });
  }

  /** A range set by hand, kept until the axis is released. */
  hold(range: IAxisRange<T>): void {
    const constrained = this.options.constrain(range);
    this.write({ current: constrained, target: constrained, isHeld: true });
  }

  release(): void {
    this.write({ ...this.state, isHeld: false });
  }

  /** Another set of cuts: the range given is already in the new virtual coordinate. */
  remap(mapping: IAxisMapping<T> | undefined, range: IAxisRange<T>): void {
    this.correspondence = mapping;
    const constrained = this.options.constrain(range);
    this.state = { ...this.state, current: constrained, target: constrained };
    this.changes += 1;
    this.options.onChange();
  }

  private write(next: IAxisViewportState<T>): void {
    const { domain } = this.options;
    const previous = this.state;
    if (
      isSameRange(domain, previous.current, next.current) &&
      isSameRange(domain, previous.target, next.target) &&
      previous.isHeld === next.isHeld
    ) {
      return;
    }
    this.state = next;
    this.changes += 1;
    this.options.onChange();
  }
}
