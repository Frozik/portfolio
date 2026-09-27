import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import { cn } from '@frozik/components/components/cn';

import type { TableModel } from '../../../core/table-model';
import type { IColumnVisibilitySlice } from '../../../extensions/column-visibility/core';
import { getTableTranslations } from '../../translations/translations';

/** A searchable checklist of the table's columns; place it anywhere near the table. */
export const ColumnPicker = observer(function ColumnPicker<TRow>({
  model,
  className,
  locale = 'en',
}: {
  readonly model: TableModel<TRow, unknown>;
  readonly className?: string;
  readonly locale?: string;
}) {
  const slice = model.extension<IColumnVisibilitySlice>('columnVisibility');
  const translations = getTableTranslations(locale);
  const [search, setSearch] = useState('');
  if (slice === undefined) {
    return null;
  }
  const needle = search.trim().toLowerCase();
  const entries = slice.entries.filter(entry => entry.title.toLowerCase().includes(needle));
  return (
    <div
      className={cn('ft-column-picker', className)}
      role="group"
      aria-label={translations.showColumns}
    >
      <input
        className="ft-column-picker-search"
        type="search"
        value={search}
        placeholder={translations.searchColumns}
        onChange={event => setSearch(event.target.value)}
      />
      <ul className="ft-column-picker-list">
        {entries.map(entry => (
          <li key={entry.id}>
            <label
              className="ft-column-picker-item"
              title={entry.lockedReason === undefined ? undefined : translations.columnLocked}
            >
              <input
                type="checkbox"
                checked={entry.visible}
                disabled={entry.lockedReason !== undefined}
                onChange={event => slice.setVisible(entry.id, event.target.checked)}
              />
              <span>{entry.title}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
});
