import type { CSSProperties, HTMLAttributes } from 'react';
import type { TAlign, TColumnKind } from '../../core/columns/column';

import type { IColumnLayout } from '../../core/columns/columns-model';
import type { ICellDecoration, INamedProps } from '../column';

const ALIGN_BY_KIND: Readonly<Record<TColumnKind, TAlign>> = {
  text: 'start',
  number: 'end',
  boolean: 'center',
  date: 'start',
  datetime: 'start',
  custom: 'start',
};

export function alignOf(layout: IColumnLayout<never>): TAlign {
  return layout.definition.align ?? ALIGN_BY_KIND[layout.definition.kind];
}

interface IPinEdges {
  readonly lastLeftId: string | undefined;
  readonly firstRightId: string | undefined;
}

/** The columns that carry the pin shadow, found once per column window rather than once per cell. */
const pinEdgesByWindow = new WeakMap<readonly IColumnLayout<never>[], IPinEdges>();

function pinEdgesOf<TRow>(columns: readonly IColumnLayout<TRow>[]): IPinEdges {
  const cached = pinEdgesByWindow.get(columns as readonly IColumnLayout<never>[]);
  if (cached !== undefined) {
    return cached;
  }
  const edges: IPinEdges = {
    lastLeftId: columns.filter(column => column.section === 'left').at(-1)?.id,
    firstRightId: columns.find(column => column.section === 'right')?.id,
  };
  pinEdgesByWindow.set(columns as readonly IColumnLayout<never>[], edges);
  return edges;
}

/** Position-related attributes shared by header and body cells of one column. */
export function positionAttributes<TRow>(
  layout: IColumnLayout<TRow>,
  columns: readonly IColumnLayout<TRow>[]
): {
  readonly 'data-column-id': string;
  readonly 'data-section': string;
  readonly 'data-pin-edge': 'left' | 'right' | undefined;
  readonly 'data-align': TAlign;
  readonly style: Record<string, string> | undefined;
} {
  const { lastLeftId, firstRightId } = pinEdgesOf(columns);
  const pinEdge =
    layout.id === lastLeftId ? 'left' : layout.id === firstRightId ? 'right' : undefined;
  return {
    'data-column-id': layout.id,
    'data-section': layout.section,
    'data-pin-edge': pinEdge,
    'data-align': alignOf(layout as IColumnLayout<never>),
    style:
      layout.stickyOffset === undefined ? undefined : { '--ft-sticky': `${layout.stickyOffset}px` },
  };
}

export interface ICellLook {
  readonly className: string | undefined;
  readonly data: Record<string, string | boolean | undefined>;
  readonly aria: Record<string, string | boolean | undefined>;
  readonly style: CSSProperties | undefined;
}

export function mergeDecorations(decorations: readonly (ICellDecoration | undefined)[]): ICellLook {
  const classNames: string[] = [];
  const data: Record<string, string | boolean | undefined> = {};
  const aria: Record<string, string | boolean | undefined> = {};
  let style: CSSProperties | undefined = undefined;
  for (const decoration of decorations) {
    if (decoration === undefined) {
      continue;
    }
    if (decoration.className !== undefined) {
      classNames.push(decoration.className);
    }
    if (decoration.style !== undefined) {
      style = Object.assign({}, style, decoration.style);
    }
    for (const [key, value] of Object.entries(decoration.data ?? {})) {
      data[`data-${key}`] = value === false ? undefined : value;
    }
    for (const [key, value] of Object.entries(decoration.aria ?? {})) {
      aria[`aria-${key}`] = value === false ? undefined : value;
    }
  }
  return {
    className: classNames.length === 0 ? undefined : classNames.join(' '),
    data,
    aria,
    style,
  };
}

/** Element attributes contributed by extensions, later contributions winning on a clash. */
export function mergeProps<TContext>(
  contributions: readonly INamedProps<TContext>[],
  context: TContext
): HTMLAttributes<HTMLDivElement> {
  const merged: HTMLAttributes<HTMLDivElement> = {};
  for (const named of contributions) {
    Object.assign(merged, named.props(context));
  }
  return merged;
}
