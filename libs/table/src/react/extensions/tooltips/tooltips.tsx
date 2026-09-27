import type { MouseEvent, ReactNode } from 'react';

import type { IExtensionInstance, ITableExtension } from '../../../core/kernel/extension';
import type {
  ITooltipAnchor,
  ITooltipsOptions,
  ITooltipsSlice,
} from '../../../extensions/tooltips/core';
import { tooltips as tooltipsCore } from '../../../extensions/tooltips/core';
import type { ICellContext, IColumn, IHeaderContext } from '../../column';
import { resolve } from '../../column';
import type { IViewContributions } from '../../slots';
import type { ITooltipSpec, TTooltip } from './tooltip-column';
import { TOOLTIP_MODES } from './tooltip-column';
import type { ITooltipContent } from './TooltipLayer';
import { tooltipLayerFor, TooltipContents } from './TooltipLayer';

function anchorOf(element: HTMLElement): ITooltipAnchor {
  const root = element.closest('.ft');
  const rect = element.getBoundingClientRect();
  const rootRect = root?.getBoundingClientRect();
  return {
    left: rect.left - (rootRect?.left ?? 0),
    top: rect.top - (rootRect?.top ?? 0),
    width: rect.width,
    height: rect.height,
  };
}

function isTruncated(element: HTMLElement): boolean {
  const text = element.querySelector('.ft-cell-text, .ft-header-title') ?? element;
  return text.scrollWidth > text.clientWidth + 1;
}

/** What the tooltip of an element shows, or `undefined` when it has none for this hover. */
function contentOf<TContext>(
  key: string,
  tooltip: TTooltip<NoInfer<TContext>>,
  context: TContext,
  element: HTMLElement,
  fallbackText: string,
  close: () => void
): ITooltipContent | undefined {
  const declared: TTooltip<TContext> = tooltip ?? 'whenTruncated';
  if (declared === 'never') {
    return undefined;
  }
  if (typeof declared === 'string' && TOOLTIP_MODES.has(declared)) {
    if (declared === 'whenTruncated' && !isTruncated(element)) {
      return undefined;
    }
    return fallbackText === ''
      ? undefined
      : {
          key,
          render: () => fallbackText,
          placement: 'bottom',
          interactive: false,
          maxWidth: undefined,
        };
  }
  if (typeof declared === 'string') {
    return {
      key,
      render: () => declared,
      placement: 'bottom',
      interactive: false,
      maxWidth: undefined,
    };
  }
  const spec: ITooltipSpec<TContext> = declared;
  const Component = spec.component;
  const render = (): ReactNode =>
    Component === undefined ? (
      (spec.text ?? fallbackText)
    ) : (
      <Component {...context} close={close} />
    );
  return {
    key,
    render,
    placement: spec.placement ?? 'bottom',
    interactive: spec.interactive ?? false,
    maxWidth: spec.maxWidth,
  };
}

function tooltipsView<TRow>(slice: ITooltipsSlice): IViewContributions<TRow> {
  const contents = new TooltipContents();
  let leaveTimer: ReturnType<typeof setTimeout> | undefined;
  const enter = (key: string, content: ITooltipContent | undefined, element: HTMLElement): void => {
    clearTimeout(leaveTimer);
    if (content === undefined) {
      slice.hide();
      return;
    }
    contents.set(content);
    slice.show(key, anchorOf(element));
  };
  const leave = (key: string, interactive: boolean): void => {
    const hide = (): void => {
      slice.hide(key);
      contents.delete(key);
    };
    if (interactive || slice.interactive) {
      leaveTimer = setTimeout(hide, slice.delayMs);
    } else {
      hide();
    }
  };
  return {
    'cell.props': [
      {
        id: 'tooltips.cell',
        props: (context: ICellContext<TRow>) => {
          const column = context.column as IColumn<TRow>;
          const key = `cell:${context.rowKey}:${column.id}`;
          return {
            onMouseEnter: (event: MouseEvent<HTMLDivElement>) => {
              const tooltip = resolve(column.tooltip, context);
              enter(
                key,
                contentOf(key, tooltip, context, event.currentTarget, context.text, () =>
                  slice.hide(key)
                ),
                event.currentTarget
              );
            },
            onMouseLeave: () =>
              leave(key, typeof column.tooltip === 'object' && column.tooltip.interactive === true),
          };
        },
      },
    ],
    'header.cell.props': [
      {
        id: 'tooltips.header',
        props: (context: IHeaderContext<TRow>) => {
          const column = context.column as IColumn<TRow>;
          const key = `header:${column.id}`;
          const title = typeof column.title === 'string' ? column.title : column.title.text;
          return {
            onMouseEnter: (event: MouseEvent<HTMLDivElement>) => {
              const tooltip = resolve(column.headerTooltip, context);
              enter(
                key,
                contentOf(key, tooltip, context, event.currentTarget, title, () => slice.hide(key)),
                event.currentTarget
              );
            },
            onMouseLeave: () => leave(key, false),
          };
        },
      },
    ],
    floating: [{ id: 'tooltips.layer', render: tooltipLayerFor<TRow>(contents) }],
  };
}

/** Cell and header tooltips: the truncated text by default, a text or a component per column, one open at a time. */
export function tooltips<TRow = never>(
  options: ITooltipsOptions = {}
): ITableExtension<TRow, 'tooltips', ITooltipsSlice> {
  const core = tooltipsCore<TRow>(options);
  return {
    ...core,
    create(kernel): IExtensionInstance<TRow, ITooltipsSlice> {
      const instance = core.create(kernel);
      return {
        ...instance,
        view: tooltipsView<TRow>(instance.slice) as Readonly<Record<string, unknown>>,
      };
    },
  };
}
