import { observer } from 'mobx-react-lite';
import type { MouseEvent } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { assert } from '@frozik/utils/assert/assert';

import type { IDetailRowsSlice } from '../../../extensions/detail-rows/core';
import type { ICellContext } from '../../column';
import { useTableContext } from '../../context';

const ARROW_OPEN = '▾';
const ARROW_CLOSED = '▸';

export const DetailToggleCell = observer(function DetailToggleCell<TRow>({
  table,
  rowKey,
}: ICellContext<TRow>) {
  const { translations } = useTableContext<TRow>();
  const slice = table.extension<IDetailRowsSlice>('detailRows');
  assert(slice !== undefined, 'The detail column renders only with the detailRows extension');
  const expanded = slice.isExpanded(rowKey);
  const handleClick = useEventCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    slice.toggle(rowKey);
  });
  if (!expanded && slice.reasonAgainst(rowKey) !== undefined) {
    return null;
  }
  return (
    <button
      type="button"
      className="ft-icon-button ft-detail-toggle"
      aria-expanded={expanded}
      aria-label={expanded ? translations.collapseRow : translations.expandRow}
      tabIndex={-1}
      onClick={handleClick}
    >
      {expanded ? ARROW_OPEN : ARROW_CLOSED}
    </button>
  );
});
