export type TPointerKind = 'mouse' | 'pen' | 'touch';

/** Positions are CSS pixels from the top-left corner of the chart. */
export interface IPointerInput {
  readonly phase: 'down' | 'move' | 'up' | 'cancel' | 'leave';
  readonly pointerId: number;
  readonly kind: TPointerKind;
  readonly x: number;
  readonly y: number;
  readonly timeStamp: number;
}

export interface IWheelInput {
  readonly x: number;
  readonly y: number;
  readonly deltaY: number;
}

export interface IPointerListener {
  /** Returning `true` takes the input: listeners of a lower priority do not see it. */
  pointer?(input: IPointerInput): boolean | void;
  wheel?(input: IWheelInput): void;
}

/** Pointer and wheel input over the chart, free of the DOM: gestures are tested by feeding it events (§3.7). */
export interface IPointerSource {
  /** Listeners are called from the highest priority down; equal priorities in the order they subscribed. */
  subscribe(listener: IPointerListener, priority?: number): VoidFunction;
  setCursor(cursor: string): void;
}

interface IPrioritised {
  readonly listener: IPointerListener;
  readonly priority: number;
}

/** The listeners of a pointer source and the order they are called in: shared by every host. */
export class PointerListeners {
  private ordered: readonly IPrioritised[] = [];

  add(listener: IPointerListener, priority = 0): VoidFunction {
    const entry: IPrioritised = { listener, priority };
    this.ordered = [...this.ordered, entry].sort(
      (first, second) => second.priority - first.priority
    );
    return () => {
      this.ordered = this.ordered.filter(each => each !== entry);
    };
  }

  pointer(input: IPointerInput): void {
    for (const { listener } of this.ordered) {
      if (listener.pointer?.(input) === true) {
        return;
      }
    }
  }

  wheel(input: IWheelInput): void {
    for (const { listener } of this.ordered) {
      listener.wheel?.(input);
    }
  }

  clear(): void {
    this.ordered = [];
  }
}
