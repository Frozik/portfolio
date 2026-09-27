import { makeAutoObservable } from 'mobx';

import type { IExtensionInstance, IKeyBinding, ITableExtension } from '../../core/kernel/extension';

export type TTooltipPlacement = 'top' | 'bottom';

export interface ITooltipsOptions {
  readonly delayMs?: number;
  /** The pointer may move into the tooltip without closing it. */
  readonly interactive?: boolean;
  readonly maxWidth?: number;
}

export interface ITooltipAnchor {
  /** Relative to the table root. */
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface IOpenTooltip {
  readonly key: string;
  readonly anchor: ITooltipAnchor;
}

export interface ITooltipsSlice {
  readonly open: IOpenTooltip | null;
  readonly delayMs: number;
  readonly interactive: boolean;
  readonly maxWidth: number;
  show(key: string, anchor: ITooltipAnchor): void;
  hide(key?: string): void;
}

const DEFAULT_DELAY_MS = 500;
const DEFAULT_MAX_WIDTH = 320;

class TooltipsSlice implements ITooltipsSlice {
  open: IOpenTooltip | null = null;
  readonly delayMs: number;
  readonly interactive: boolean;
  readonly maxWidth: number;

  constructor(options: ITooltipsOptions) {
    this.delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
    this.interactive = options.interactive ?? false;
    this.maxWidth = options.maxWidth ?? DEFAULT_MAX_WIDTH;
    makeAutoObservable(this, {}, { autoBind: true });
  }

  show(key: string, anchor: ITooltipAnchor): void {
    this.open = { key, anchor };
  }

  hide(key?: string): void {
    if (key === undefined || this.open?.key === key) {
      this.open = null;
    }
  }
}

/** One tooltip at a time; what it shows is the view's business, the kernel only knows which cell owns it. */
export function tooltips<TRow = never>(
  options: ITooltipsOptions = {}
): ITableExtension<TRow, 'tooltips', ITooltipsSlice> {
  return {
    id: 'tooltips',
    create(): IExtensionInstance<TRow, ITooltipsSlice> {
      const slice = new TooltipsSlice(options);
      const keys: readonly IKeyBinding<TRow>[] = [
        { key: 'Escape', target: 'cell', run: () => slice.open !== null && (slice.hide(), true) },
      ];
      return { slice, keys, dispose: () => undefined };
    },
  };
}
