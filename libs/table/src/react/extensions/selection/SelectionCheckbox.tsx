import { observer } from 'mobx-react-lite';
import type { MouseEvent } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { assert } from '@frozik/utils/assert/assert';

import type {
  ISelectionSlice,
  THeaderCheckboxState,
} from '../../../extensions/selection/contracts';
import type { ICellContext, IHeaderContext } from '../../column';
import { useTableContext } from '../../context';

function Checkbox({
  state,
  label,
  disabled,
  onClick,
}: {
  readonly state: THeaderCheckboxState;
  readonly label: string;
  readonly disabled?: boolean;
  readonly onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      className="ft-checkbox"
      aria-checked={state === 'some' ? 'mixed' : state === 'all'}
      aria-label={label}
      data-state={state === 'all' ? 'checked' : state === 'some' ? 'indeterminate' : 'unchecked'}
      disabled={disabled}
      tabIndex={-1}
      onClick={onClick}
    />
  );
}

function sliceOf<TRow>(context: {
  readonly table: ICellContext<TRow>['table'];
}): ISelectionSlice<TRow> {
  const slice = context.table.extension<ISelectionSlice<TRow>>('selection');
  assert(slice !== undefined, 'The selection column renders only with the selection extension');
  return slice;
}

export const SelectionCell = observer(function SelectionCell<TRow>(context: ICellContext<TRow>) {
  const { translations } = useTableContext<TRow>();
  const slice = sliceOf(context);
  const { rowKey } = context;
  const selected = slice.isSelected(rowKey);
  const handleClick = useEventCallback((event: MouseEvent<HTMLButtonElement>) => {
    if (event.shiftKey) {
      slice.range(rowKey, { add: true });
    } else {
      slice.toggle(rowKey);
    }
  });
  return (
    <Checkbox
      state={selected ? 'all' : 'none'}
      label={translations.selectRow}
      disabled={!selected && slice.reasonAgainst(rowKey) !== undefined}
      onClick={handleClick}
    />
  );
});

export const SelectionHeader = observer(function SelectionHeader<TRow>(
  context: IHeaderContext<TRow>
) {
  const { translations } = useTableContext<TRow>();
  const slice = sliceOf(context);
  const handleClick = useEventCallback(() => {
    if (slice.headerState === 'all') {
      slice.clear();
    } else {
      slice.selectAll();
    }
  });
  if (!slice.headerCheckbox || slice.mode.rows !== 'multiple') {
    return null;
  }
  return (
    <Checkbox state={slice.headerState} label={translations.selectAll} onClick={handleClick} />
  );
});
