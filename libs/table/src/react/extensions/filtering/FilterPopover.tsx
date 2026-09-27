import { observer } from 'mobx-react-lite';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { useEventCallback } from 'usehooks-ts';

import type { TFilterModel } from '../../../extensions/filtering/model';
import type { IColumn } from '../../column';
import { useTableContext } from '../../context';
import type { IViewContext } from '../../slots';
import type { IFilterEditorContext, TFilterEditor } from './filtering-column';
import { useFiltering } from './filtering-context';
import { ChoiceForm } from './forms/ChoiceForm';
import { ConditionForm } from './forms/ConditionForm';
import { SetForm } from './forms/SetForm';
import { ANCHOR_ATTRIBUTE } from './ui-state';

const POPOVER_WIDTH = 280;
const EDGE_GAP = 8;

function editorFor<TRow>(column: IColumn<TRow>, kind: string): TFilterEditor<TRow> | undefined {
  if (column.filterEditor !== undefined) {
    return column.filterEditor;
  }
  switch (kind) {
    case 'text':
    case 'number':
    case 'date':
      return ConditionForm;
    case 'set':
      return SetForm;
    case 'enum':
    case 'boolean':
      return ChoiceForm;
    default:
      return undefined;
  }
}

/** The full editor of one column's filter, anchored under its header cell or filter field. */
export const FilterPopover = observer(function FilterPopover<TRow>(_: IViewContext<TRow>) {
  const { table, translations } = useTableContext<TRow>();
  const { slice, ui } = useFiltering();
  const anchor = ui.anchor;
  const popoverRef = useRef<HTMLDivElement>(null);
  const layout = anchor === null ? undefined : table.columns.visibleById.get(anchor.columnId);
  const column = layout?.definition as IColumn<TRow> | undefined;
  const spec = anchor === null ? undefined : slice.specOf(anchor.columnId);
  const model = anchor === null ? undefined : slice.modelOf(anchor.columnId);
  const set = useEventCallback((next: TFilterModel | null) => {
    if (anchor !== null) {
      slice.set(anchor.columnId, next);
    }
  });
  const context = useMemo<IFilterEditorContext<TRow> | undefined>(
    () =>
      column === undefined || layout === undefined || spec === undefined
        ? undefined
        : { table, column, layout, spec, model, set },
    [table, column, layout, spec, model, set]
  );

  useEffect(() => {
    if (anchor === null) {
      return undefined;
    }
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const insidePopover = popoverRef.current?.contains(target) === true;
      const onAnchor = target.closest(`[${ANCHOR_ATTRIBUTE}="${anchor.columnId}"]`) !== null;
      if (!insidePopover && !onAnchor) {
        ui.close();
      }
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        ui.close();
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [anchor, ui]);

  if (anchor === null || context === undefined || column === undefined) {
    return null;
  }
  const Editor = editorFor(column, context.spec.kind);
  if (Editor === undefined) {
    return null;
  }
  const rootWidth = popoverRef.current?.parentElement?.clientWidth;
  const left =
    rootWidth === undefined
      ? anchor.left
      : Math.max(EDGE_GAP, Math.min(anchor.left, rootWidth - POPOVER_WIDTH - EDGE_GAP));
  const style: CSSProperties = { left, top: anchor.top, width: POPOVER_WIDTH };
  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={translations.filter}
      className="ft-filter-popover"
      style={style}
    >
      <Editor {...context} />
    </div>
  );
});
