import { memo, useRef } from 'react';

import type { IRichEditorHandle } from '@frozik/components/components/RichEditor/defs';
import { NumericEditor } from '@frozik/components/components/RichEditor/NumericEditor';

import type { ICellEdit, ICellProps, TCellComponent } from '../column';
import { useTableContext } from '../context';
import { selectAllOnFocus } from './selectAllOnFocus';
import { useFieldFocus } from './useFieldFocus';
import { useInitialKey } from './useInitialKey';

export interface INumberCellOptions {
  readonly decimal?: number;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly allowNegative?: boolean;
}

type TNumber = number | undefined;

function NumberField({
  edit,
  options,
}: {
  readonly edit: ICellEdit<TNumber>;
  readonly options: INumberCellOptions;
}) {
  const { numberLocale } = useTableContext();
  const ref = useRef<IRichEditorHandle>(null);
  useFieldFocus(ref);
  useInitialKey(edit, key => {
    const digit = Number(key);
    return Number.isInteger(digit) ? digit : undefined;
  });
  return (
    <NumericEditor
      ref={ref}
      className="ft-cell-field"
      value={edit.draft}
      onValueChange={edit.update}
      decimal={options.decimal}
      min={options.min}
      max={options.max}
      step={options.step}
      allowNegative={options.allowNegative ?? true}
      locale={numberLocale}
      onFocusSelection={selectAllOnFocus}
    />
  );
}

/** The formatted number in view mode, a numeric field with the given bounds in edit mode. */
export function numberCell<TRow>(options: INumberCellOptions = {}): TCellComponent<TRow, TNumber> {
  return memo(function NumberCell({ text, mode, edit }: ICellProps<TRow, TNumber>) {
    return mode === 'edit' ? <NumberField edit={edit} options={options} /> : text;
  });
}

export const NumberCell = numberCell<unknown>();
