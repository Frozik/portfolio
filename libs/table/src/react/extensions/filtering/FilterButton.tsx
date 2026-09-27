import { observer } from 'mobx-react-lite';
import type { MouseEvent } from 'react';
import { useEventCallback } from 'usehooks-ts';

import type { IHeaderContext } from '../../column';
import { useTableContext } from '../../context';
import { useFiltering } from './filtering-context';
import { ANCHOR_ATTRIBUTE, anchorOf } from './ui-state';

const FUNNEL = 'M2 3h12l-4.5 5.5V13l-3-1.5V8.5Z';

export const FilterButton = observer(function FilterButton<TRow>({ column }: IHeaderContext<TRow>) {
  const { translations } = useTableContext<TRow>();
  const { slice, ui } = useFiltering();
  const handleClick = useEventCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    ui.toggle(anchorOf(event.currentTarget, column.id));
  });
  if (slice.reasonAgainst(column.id) !== undefined) {
    return null;
  }
  const active = slice.modelOf(column.id) !== undefined;
  return (
    <button
      type="button"
      className="ft-icon-button ft-filter-button"
      aria-label={translations.filter}
      title={translations.filter}
      data-active={active ? '' : undefined}
      {...{ [ANCHOR_ATTRIBUTE]: column.id }}
      onClick={handleClick}
    >
      <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden>
        <path
          d={FUNNEL}
          fill={active ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
});
