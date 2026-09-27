import { observer } from 'mobx-react-lite';
import type { ChangeEvent } from 'react';
import { useEventCallback } from 'usehooks-ts';

import type { IEnumFilterOptions } from '../../../../extensions/filtering/specs/enum';
import { useTableContext } from '../../../context';
import type { IFilterFieldContext } from '../filtering-column';

export const EnumField = observer(function EnumField<TRow>({
  model,
  spec,
  set,
}: IFilterFieldContext<TRow>) {
  const { translations } = useTableContext<TRow>();
  const options = (spec.options as IEnumFilterOptions<unknown>).options;
  const handleChange = useEventCallback((event: ChangeEvent<HTMLSelectElement>) =>
    set({ kind: 'enum', value: event.target.value })
  );
  return (
    <select
      className="ft-filter-field ft-filter-select"
      value={model?.kind === 'enum' ? model.value : ''}
      aria-label={translations.filter}
      onChange={handleChange}
    >
      <option value="">{translations.any}</option>
      {options.map(option => (
        <option key={option.key} value={option.key}>
          {option.label}
        </option>
      ))}
    </select>
  );
});
