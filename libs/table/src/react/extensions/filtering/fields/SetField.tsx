import { observer } from 'mobx-react-lite';

import { useTableContext } from '../../../context';
import type { IFilterFieldContext } from '../filtering-column';
import { summaryOf } from '../summary';
import { SummaryField } from './SummaryField';

export const SetField = observer(function SetField<TRow>({
  model,
  openEditor,
}: IFilterFieldContext<TRow>) {
  const { translations } = useTableContext<TRow>();
  return (
    <SummaryField
      text={model === undefined ? undefined : summaryOf(model, translations)}
      placeholder={translations.any}
      onOpen={openEditor}
    />
  );
});
