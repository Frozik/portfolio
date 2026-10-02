import type { IChartHost } from '../core/host/chart-host';
import type { IPointerInput, IWheelInput } from '../core/host/pointer-source';
import { PointerListeners } from '../core/host/pointer-source';
import type { IChartSize } from '../core/host/size-source';

/** A chart host for tests: the size is set and pointer input is fed by hand. */
export interface IFakeHost extends IChartHost {
  resize(size: IChartSize): void;
  pointer: IChartHost['pointer'] & {
    feed(input: IPointerInput): void;
    wheel(input: IWheelInput): void;
    readonly cursor: string;
  };
}

export function createFakeHost(initialSize: IChartSize): IFakeHost {
  let size = initialSize;
  let cursor = '';
  const listeners = new PointerListeners();

  return {
    resize(next): void {
      size = next;
    },
    size: { measure: () => size },
    pointer: {
      subscribe: (listener, priority) => listeners.add(listener, priority),
      setCursor(next): void {
        cursor = next;
      },
      feed: input => listeners.pointer(input),
      wheel: input => listeners.wheel(input),
      get cursor(): string {
        return cursor;
      },
    },
  };
}
