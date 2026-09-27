import { observer } from 'mobx-react-lite';
import type { ChangeEvent } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { cn } from '@frozik/components/components/cn';

import type { TableModel } from '../../../core/table-model';
import type { IFilteringSlice } from '../../../extensions/filtering/contracts';
import { getTableTranslations } from '../../translations/translations';
import { useDebouncedValue } from './useDebouncedValue';

const DEFAULT_DEBOUNCE_MS = 250;

/** A search box over every text column; place it anywhere near the table. */
export const QuickFilter = observer(function QuickFilter<TRow>({
  model,
  className,
  locale = 'en',
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: {
  readonly model: TableModel<TRow, unknown>;
  readonly className?: string;
  readonly locale?: string;
  readonly debounceMs?: number;
}) {
  const slice = model.extension<IFilteringSlice>('filtering');
  const translations = getTableTranslations(locale);
  const commit = useEventCallback((text: string) => slice?.setQuick({ text }));
  const [draft, change] = useDebouncedValue(slice?.quick.text ?? '', commit, debounceMs);
  const handleChange = useEventCallback((event: ChangeEvent<HTMLInputElement>) =>
    change(event.target.value)
  );
  const toggleMode = useEventCallback(() =>
    slice?.setQuick({ mode: slice.quick.mode === 'regexp' ? 'text' : 'regexp' })
  );
  if (slice === undefined) {
    return null;
  }
  return (
    <span
      className={cn('ft-quick-filter', className)}
      data-invalid={slice.quickInvalid ? '' : undefined}
    >
      <input
        className="ft-filter-input"
        type="search"
        value={draft}
        placeholder={translations.quickFilter}
        aria-label={translations.quickFilter}
        aria-invalid={slice.quickInvalid}
        title={slice.quickInvalid ? translations.invalidRegexp : undefined}
        onChange={handleChange}
      />
      <button
        type="button"
        className="ft-icon-button ft-quick-filter-mode"
        data-active={slice.quick.mode === 'regexp' ? '' : undefined}
        aria-pressed={slice.quick.mode === 'regexp'}
        title={translations.regexpMode}
        onClick={toggleMode}
      >
        .*
      </button>
    </span>
  );
});
