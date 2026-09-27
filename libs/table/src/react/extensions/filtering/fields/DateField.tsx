import { observer } from 'mobx-react-lite';
import type { ChangeEvent } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { useTableContext } from '../../../context';
import type { IFilterFieldContext } from '../filtering-column';
import { isSimpleModel, summaryOf } from '../summary';
import { DEFAULT_DATE_OP, dateRangeModel } from './models';
import { SummaryField } from './SummaryField';

function boundsOf(model: IFilterFieldContext<never>['model']): readonly [string, string] {
  if (model?.kind !== 'date' || model.conditions.length !== 1) {
    return ['', ''];
  }
  const [condition] = model.conditions;
  switch (condition.op) {
    case 'between':
      return [condition.from ?? '', condition.to ?? ''];
    case 'greaterOrEqual':
      return [condition.from ?? '', ''];
    case 'lessOrEqual':
      return ['', condition.from ?? ''];
    default:
      return ['', ''];
  }
}

export const DateField = observer(function DateField<TRow>(context: IFilterFieldContext<TRow>) {
  const { translations } = useTableContext<TRow>();
  const { model, set, openEditor, column } = context;
  const inputType = column.kind === 'datetime' ? 'datetime-local' : 'date';
  const [from, to] = boundsOf(model);
  const handleFrom = useEventCallback((event: ChangeEvent<HTMLInputElement>) =>
    set(dateRangeModel(event.target.value, to))
  );
  const handleTo = useEventCallback((event: ChangeEvent<HTMLInputElement>) =>
    set(dateRangeModel(from, event.target.value))
  );
  if (!isSimpleModel(model, DEFAULT_DATE_OP) && model !== undefined) {
    return (
      <SummaryField text={summaryOf(model, translations)} placeholder="" onOpen={openEditor} />
    );
  }
  return (
    <span className="ft-filter-range">
      <input
        className="ft-filter-field ft-filter-input"
        type={inputType}
        value={from}
        aria-label={translations.from}
        onChange={handleFrom}
      />
      <input
        className="ft-filter-field ft-filter-input"
        type={inputType}
        value={to}
        aria-label={translations.to}
        onChange={handleTo}
      />
    </span>
  );
});
