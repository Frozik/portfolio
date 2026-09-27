import { observer } from 'mobx-react-lite';
import type { ChangeEvent } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { useTableContext } from '../../../context';
import type { IFilterFieldContext } from '../filtering-column';

const ANY = '';
const YES = 'yes';
const NO = 'no';

export const BooleanField = observer(function BooleanField<TRow>({
  model,
  set,
}: IFilterFieldContext<TRow>) {
  const { translations } = useTableContext<TRow>();
  const handleChange = useEventCallback((event: ChangeEvent<HTMLSelectElement>) =>
    set(event.target.value === ANY ? null : { kind: 'boolean', value: event.target.value === YES })
  );
  const value = model?.kind === 'boolean' ? (model.value ? YES : NO) : ANY;
  return (
    <select
      className="ft-filter-field ft-filter-select"
      value={value}
      aria-label={translations.filter}
      onChange={handleChange}
    >
      <option value={ANY}>{translations.any}</option>
      <option value={YES}>{translations.yes}</option>
      <option value={NO}>{translations.no}</option>
    </select>
  );
});
