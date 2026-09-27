import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import type { IFilterOption } from '../../../../extensions/filtering/spec';
import type { TSetFilterSpec } from '../../../../extensions/filtering/specs/set';
import { useTableContext } from '../../../context';
import type { IFilterEditorContext } from '../filtering-column';
import { useFiltering } from '../filtering-context';

function useSetOptions(
  spec: TSetFilterSpec<unknown>,
  columnId: string,
  search: string
): readonly IFilterOption[] {
  const { slice } = useFiltering();
  const { values, extraOption } = spec.options;
  const [remote, setRemote] = useState<readonly IFilterOption[]>([]);

  useEffect(() => {
    if (typeof values !== 'function') {
      return undefined;
    }
    const controller = new AbortController();
    values(search, controller.signal).then(
      options => !controller.signal.aborted && setRemote(options),
      () => undefined
    );
    return () => controller.abort();
  }, [values, search]);

  return useMemo(() => {
    const own =
      typeof values === 'function'
        ? remote
        : (values === 'accumulate' ? slice.valuesSeen(columnId) : values).map(value => ({
            key: spec.keyOf(value),
            label: spec.labelOf(value),
          }));
    const withExtra =
      extraOption === undefined || own.some(option => option.key === extraOption.key)
        ? own
        : [...own, extraOption];
    const needle = search.trim().toLowerCase();
    return needle === ''
      ? withExtra
      : withExtra.filter(option => option.label.toLowerCase().includes(needle));
  }, [values, remote, slice, columnId, spec, extraOption, search]);
}

/** Searchable checklist with select-all; the model keeps the chosen keys. */
export const SetForm = observer(function SetForm<TRow>({
  spec,
  column,
  model,
  set,
}: IFilterEditorContext<TRow>) {
  const { translations } = useTableContext<TRow>();
  const [search, setSearch] = useState('');
  const options = useSetOptions(spec as TSetFilterSpec<unknown>, column.id, search);
  const chosen = useMemo(() => new Set(model?.kind === 'set' ? model.values : []), [model]);
  const allChosen = options.length > 0 && options.every(option => chosen.has(option.key));
  const someChosen = options.some(option => chosen.has(option.key));

  const commit = (keys: ReadonlySet<string>): void => set({ kind: 'set', values: [...keys] });
  const toggleAll = useEventCallback(() => {
    const next = new Set(chosen);
    for (const option of options) {
      if (allChosen) {
        next.delete(option.key);
      } else {
        next.add(option.key);
      }
    }
    commit(next);
  });
  const clear = useEventCallback(() => set(null));

  return (
    <div className="ft-filter-form">
      <input
        className="ft-filter-input"
        type="search"
        value={search}
        placeholder={translations.searchValues}
        onChange={event => setSearch(event.target.value)}
      />
      <label className="ft-filter-option">
        <input
          type="checkbox"
          checked={allChosen}
          ref={element => {
            if (element !== null) {
              element.indeterminate = someChosen && !allChosen;
            }
          }}
          onChange={toggleAll}
        />
        <span>{translations.selectAllValues}</span>
      </label>
      <div className="ft-filter-options">
        {options.map(option => (
          <label key={option.key} className="ft-filter-option">
            <input
              type="checkbox"
              checked={chosen.has(option.key)}
              onChange={event => {
                const next = new Set(chosen);
                if (event.target.checked) {
                  next.add(option.key);
                } else {
                  next.delete(option.key);
                }
                commit(next);
              }}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <div className="ft-filter-actions">
        <button type="button" className="ft-link-button" onClick={clear}>
          {translations.clearFilter}
        </button>
      </div>
    </div>
  );
});
