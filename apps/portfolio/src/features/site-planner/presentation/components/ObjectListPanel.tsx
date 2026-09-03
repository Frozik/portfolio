import { cn } from '@frozik/components/components/cn';
import { isNil } from 'lodash-es';
import type { LucideIcon } from 'lucide-react';
import { TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { PanelHint } from './PanelHint';
import { PlannerPanel } from './PlannerPanel';

const GLYPH_SIZE_PX = 12;

/** One button on a row: the acts that are not a number to type. */
export interface ObjectRowAction {
  readonly key: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly onClick: () => void;
}

/**
 * One object of a storey as a list shows it: what it is, the derived number
 * worth stating beside it, whatever the advisory has to say, and the acts that
 * are not a typed value.
 */
export interface ObjectRow {
  readonly key: string;
  readonly label: string;
  /** Right-aligned monospace note — an area, a length, an elevation. */
  readonly note?: string;
  /** A second line under the label: what the model DERIVED about this object. */
  readonly detail?: string;
  readonly isSelected?: boolean;
  /** Amber triangle with this as its label — a finding about this very row. */
  readonly warning?: string;
  readonly onSelect?: () => void;
  readonly actions?: readonly ObjectRowAction[];
}

/**
 * Plain components rather than memoised ones: a row is rebuilt from the scene
 * on every observable change, so its props are new every time and `memo` would
 * only add a comparison that never succeeds.
 */
function RowButton({ action }: { readonly action: ObjectRowAction }) {
  return (
    <button
      type="button"
      aria-label={action.label}
      title={action.label}
      onClick={action.onClick}
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded text-text-secondary',
        'transition-colors duration-150 hover:bg-white/10 hover:text-text'
      )}
    >
      <action.icon size={GLYPH_SIZE_PX} aria-hidden />
    </button>
  );
}

function Row({ row }: { readonly row: ObjectRow }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-md border p-1.5',
        row.isSelected === true ? 'border-brand-500/60 bg-brand-500/20' : 'border-white/10'
      )}
    >
      <div className="flex items-center gap-1.5">
        {isNil(row.onSelect) ? (
          <span className="min-w-0 flex-1 truncate text-[11px] text-text">{row.label}</span>
        ) : (
          <button
            type="button"
            onClick={row.onSelect}
            className="min-w-0 flex-1 truncate text-left text-[11px] text-text"
          >
            {row.label}
          </button>
        )}
        {isNil(row.warning) ? undefined : (
          <TriangleAlert
            size={GLYPH_SIZE_PX}
            className="shrink-0 text-amber-500"
            aria-label={row.warning}
          />
        )}
        {isNil(row.note) ? undefined : (
          <span className="shrink-0 font-mono text-[10px] text-text-secondary">{row.note}</span>
        )}
        {(row.actions ?? []).map(action => (
          <RowButton key={action.key} action={action} />
        ))}
      </div>
      {isNil(row.detail) ? undefined : (
        <span className="font-mono text-[10px] text-text-secondary">{row.detail}</span>
      )}
    </div>
  );
}

/**
 * The list every storey-object panel is (`object-editors.md`): stairs, posts,
 * slabs, fires, shafts. They differed only in what each row SAYS, so they now
 * differ only in that — the card, the selected state, the buttons, the empty
 * hint and the layout are one component, and a new kind of object contributes
 * a mapping from its scene to rows rather than a sixth copy of this file.
 */
export function ObjectListPanel({
  title,
  rows,
  emptyHint,
  children,
}: {
  readonly title: string;
  readonly rows: readonly ObjectRow[];
  readonly emptyHint: string;
  /** Anything the panel shows above its list — the roof's own controls. */
  readonly children?: ReactNode;
}) {
  return (
    <PlannerPanel title={title}>
      {children}
      {rows.map(row => (
        <Row key={row.key} row={row} />
      ))}
      {rows.length === 0 ? <PanelHint>{emptyHint}</PanelHint> : undefined}
    </PlannerPanel>
  );
}
