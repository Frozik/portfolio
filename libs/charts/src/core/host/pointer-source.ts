import { isNil } from 'lodash-es';

export type TPointerKind = 'mouse' | 'pen' | 'touch';

/** Positions are CSS pixels from the top-left corner of the chart. */
export interface IPointerInput {
  readonly phase: 'down' | 'move' | 'up' | 'cancel' | 'leave';
  readonly pointerId: number;
  readonly kind: TPointerKind;
  readonly x: number;
  readonly y: number;
  readonly timeStamp: number;
  /** Shift held: the gesture is meant for the value scales, not the X axis. */
  readonly shiftKey: boolean;
}

export interface IWheelInput {
  readonly x: number;
  readonly y: number;
  readonly deltaY: number;
  /** Shift held: the turn is meant for the value scales, not the X axis. */
  readonly shiftKey: boolean;
}

export interface IPointerListener {
  /** Returning `true` takes the input: listeners of a lower priority do not see it. */
  pointer?(input: IPointerInput): boolean | void;
  wheel?(input: IWheelInput): boolean | void;
}

/** Pointer and wheel input over the chart, free of the DOM: gestures are tested by feeding it events (§3.7). */
export interface IPointerSource {
  /** Listeners are called from the highest priority down; equal priorities in the order they subscribed. */
  subscribe(listener: IPointerListener, priority?: number): VoidFunction;
  /** The cursor asked for at a priority; the highest priority asking for one is shown. None takes the ask back. */
  setCursor(cursor: string | undefined, priority?: number): void;
}

/** The cursors asked for at every priority and the one to show: shared by every host. */
export class CursorLayers {
  private readonly asked = new Map<number, string>();

  set(cursor: string | undefined, priority: number): string {
    if (isNil(cursor)) {
      this.asked.delete(priority);
    } else {
      this.asked.set(priority, cursor);
    }
    const top = Math.max(...this.asked.keys());
    return this.asked.get(top) ?? '';
  }
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
      if (listener.wheel?.(input) === true) {
        return;
      }
    }
  }

  clear(): void {
    this.ordered = [];
  }
}
