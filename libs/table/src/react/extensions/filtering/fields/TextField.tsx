import { observer } from 'mobx-react-lite';
import type { ChangeEvent } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { useTableContext } from '../../../context';
import type { IFilterFieldContext } from '../filtering-column';
import { useFiltering } from '../filtering-context';
import { isSimpleModel, summaryOf } from '../summary';
import { useDebouncedValue } from '../useDebouncedValue';
import { DEFAULT_TEXT_OP, textModel } from './models';
import { SummaryField } from './SummaryField';

export const TextField = observer(function TextField<TRow>(context: IFilterFieldContext<TRow>) {
  const { translations } = useTableContext<TRow>();
  const { debounceMs } = useFiltering();
  const { model, set, openEditor } = context;
  const current = model?.kind === 'text' ? (model.conditions[0]?.text ?? '') : '';
  const commit = useEventCallback((text: string) =>
    set(textModel(text.trim() === '' ? [] : [{ op: DEFAULT_TEXT_OP, text }]))
  );
  const [draft, change] = useDebouncedValue(current, commit, debounceMs);
  const handleChange = useEventCallback((event: ChangeEvent<HTMLInputElement>) =>
    change(event.target.value)
  );
  if (!isSimpleModel(model, DEFAULT_TEXT_OP) && model !== undefined) {
    return (
      <SummaryField text={summaryOf(model, translations)} placeholder="" onOpen={openEditor} />
    );
  }
  return (
    <input
      className="ft-filter-field ft-filter-input"
      type="search"
      value={draft}
      placeholder={translations.filterOps[DEFAULT_TEXT_OP]}
      aria-label={translations.filter}
      onChange={handleChange}
    />
  );
});
