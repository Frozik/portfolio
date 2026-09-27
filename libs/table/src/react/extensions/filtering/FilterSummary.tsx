import { observer } from 'mobx-react-lite';

import { useTableContext } from '../../context';
import type { IViewContext } from '../../slots';
import { useFiltering } from './filtering-context';

/** "N filters · reset" in the toolbar, present only while something is filtered. */
export const FilterSummary = observer(function FilterSummary<TRow>(_: IViewContext<TRow>) {
  const { translations } = useTableContext<TRow>();
  const { slice } = useFiltering();
  if (slice.activeCount === 0) {
    return null;
  }
  return (
    <span className="ft-filter-summary">
      {translations.filtersActive(slice.activeCount)}
      <button type="button" className="ft-link-button" onClick={slice.clear}>
        {translations.resetFilters}
      </button>
    </span>
  );
});
