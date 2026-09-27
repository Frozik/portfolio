import type { ReactNode } from 'react';

import type { TBivariantCallback } from '../../../core/kernel/callback';
import type { TResolvable } from '../../column';

export type TTooltipMode = 'whenTruncated' | 'always' | 'never';

export interface ITooltipSpec<TContext> {
  readonly component?: TBivariantCallback<[props: TContext & { close(): void }], ReactNode>;
  readonly text?: string;
  readonly delayMs?: number;
  readonly interactive?: boolean;
  readonly placement?: 'top' | 'bottom';
  readonly maxWidth?: number;
}

/** A mode for the cell text, a text of its own, or a spec with a component. */
export type TTooltip<TContext> = TTooltipMode | string | ITooltipSpec<TContext> | undefined;

declare module '../../column' {
  interface IColumn<TRow, TValue> {
    readonly tooltip?: NoInfer<
      TResolvable<TTooltip<ICellContext<TRow, TValue>>, ICellContext<TRow, TValue>>
    >;
    readonly headerTooltip?: NoInfer<
      TResolvable<TTooltip<IHeaderContext<TRow, TValue>>, IHeaderContext<TRow, TValue>>
    >;
  }
}

export const TOOLTIP_MODES: ReadonlySet<string> = new Set(['whenTruncated', 'always', 'never']);
