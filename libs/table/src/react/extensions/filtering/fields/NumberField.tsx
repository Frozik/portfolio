import { observer } from 'mobx-react-lite';
import type { ChangeEvent } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { useTableContext } from '../../../context';
import type { IFilterFieldContext } from '../filtering-column';
import { useFiltering } from '../filtering-context';
import { isSimpleModel, summaryOf } from '../summary';
import { useDebouncedValue } from '../useDebouncedValue';
import { DEFAULT_NUMBER_OP, numberModel, numberText, parseNumber } from './models';
import { SummaryField } from './SummaryField';

export const NumberField = observer(function NumberField<TRow>(context: IFilterFieldContext<TRow>) {
  const { translations, numberLocale } = useTableContext<TRow>();
  const { debounceMs } = useFiltering();
  const { model, set, openEditor } = context;
  const current =
    model?.kind === 'number' && model.conditions[0]?.from !== undefined
      ? numberText(model.conditions[0].from, numberLocale)
      : '';
  const commit = useEventCallback((text: string) => {
    const value = parseNumber(text, numberLocale);
    set(numberModel(value === undefined ? [] : [{ op: DEFAULT_NUMBER_OP, from: value }]));
  });
  const [draft, change] = useDebouncedValue(current, commit, debounceMs);
  const handleChange = useEventCallback((event: ChangeEvent<HTMLInputElement>) =>
    change(event.target.value)
  );
  if (!isSimpleModel(model, DEFAULT_NUMBER_OP) && model !== undefined) {
    return (
      <SummaryField text={summaryOf(model, translations)} placeholder="" onOpen={openEditor} />
    );
  }
  return (
    <input
      className="ft-filter-field ft-filter-input"
      type="text"
      inputMode="decimal"
      value={draft}
      placeholder={translations.filterOps[DEFAULT_NUMBER_OP]}
      aria-label={translations.filter}
      onChange={handleChange}
    />
  );
});
