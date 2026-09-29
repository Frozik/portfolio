import type { KeyboardEvent } from 'react';
import { memo, useEffect, useRef, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import type { TBivariantCallback } from '../../core/kernel/callback';
import type { ICellProps, TCellComponent } from '../column';

export interface ISelectOption<TValue> {
  readonly value: TValue;
  readonly label: string;
}

export interface ISelectCellOptions<TRow, TValue> {
  readonly values:
    | readonly ISelectOption<TValue>[]
    | TBivariantCallback<[row: TRow], readonly ISelectOption<TValue>[]>;
  /** What the cell shows in both modes; the label of the current value by default. */
  readonly view?: TCellComponent<TRow, TValue>;
}

function SelectList<TRow, TValue>({
  edit,
  row,
  options,
}: ICellProps<TRow, TValue> & { readonly options: ISelectCellOptions<TRow, TValue> }) {
  const values = typeof options.values === 'function' ? options.values(row) : options.values;
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      values.findIndex(option => Object.is(option.value, edit.draft))
    )
  );
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.focus();
  }, []);

  const pick = useEventCallback((index: number) => {
    const option = values[index];
    if (option !== undefined) {
      edit.update(option.value);
      edit.commit();
    }
  });

  const handleKeyDown = useEventCallback((event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        setActive(index => Math.min(values.length - 1, index + 1));
        break;
      case 'ArrowUp':
        setActive(index => Math.max(0, index - 1));
        break;
      case 'Enter':
        pick(active);
        break;
      case 'Escape':
        edit.cancel();
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  });

  return (
    <div
      ref={listRef}
      role="listbox"
      tabIndex={0}
      className="ft-cell-popup ft-cell-list"
      onKeyDown={handleKeyDown}
    >
      {values.map((option, index) => (
        <div
          key={option.label}
          role="option"
          tabIndex={-1}
          aria-selected={Object.is(option.value, edit.draft)}
          className="ft-cell-option"
          data-active={index === active ? '' : undefined}
          onMouseEnter={() => setActive(index)}
          onClick={() => pick(index)}
        >
          {option.label}
        </div>
      ))}
    </div>
  );
}

/** The label of the value in view mode; in edit mode the view stays and a list opens under the cell. */
export function selectCell<TRow, TValue>(
  options: ISelectCellOptions<TRow, TValue>
): TCellComponent<TRow, TValue> {
  const View = options.view;
  return memo(function SelectCell(props: ICellProps<TRow, TValue>) {
    const values =
      typeof options.values === 'function' ? options.values(props.row) : options.values;
    const label = values.find(option => Object.is(option.value, props.value))?.label ?? props.text;
    return (
      <>
        <span className="ft-cell-select">{View === undefined ? label : <View {...props} />}</span>
        {props.mode === 'edit' && <SelectList {...props} options={options} />}
      </>
    );
  });
}
