import { observer } from 'mobx-react-lite';
import { useEventCallback } from 'usehooks-ts';

import type { IEnumFilterOptions } from '../../../../extensions/filtering/specs/enum';
import { useTableContext } from '../../../context';
import type { IFilterEditorContext } from '../filtering-column';

const ANY = '';

/** One choice out of a short list: enum options, or yes / no for a boolean. */
export const ChoiceForm = observer(function ChoiceForm<TRow>({
  spec,
  model,
  set,
}: IFilterEditorContext<TRow>) {
  const { translations } = useTableContext<TRow>();
  const options =
    spec.kind === 'boolean'
      ? [
          { key: 'true', label: translations.yes },
          { key: 'false', label: translations.no },
        ]
      : (spec.options as IEnumFilterOptions<unknown>).options;
  const current =
    model?.kind === 'boolean' ? String(model.value) : model?.kind === 'enum' ? model.value : ANY;
  const choose = useEventCallback((key: string) => {
    if (key === ANY) {
      set(null);
    } else if (spec.kind === 'boolean') {
      set({ kind: 'boolean', value: key === 'true' });
    } else {
      set({ kind: 'enum', value: key });
    }
  });
  return (
    <div className="ft-filter-form">
      {[{ key: ANY, label: translations.any }, ...options].map(option => (
        <label key={option.key} className="ft-filter-option">
          <input
            type="radio"
            checked={current === option.key}
            onChange={() => choose(option.key)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
});
