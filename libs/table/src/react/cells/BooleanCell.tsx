import type { ICellProps } from '../column';

const CHECKED = '✓';
const UNCHECKED = '–';

/** A mark that flips on click, Space or Enter when the cell is editable; there is no edit mode, the change goes straight to the table. */
export function BooleanCell<TRow>({ value, editable, edit }: ICellProps<TRow, boolean>) {
  const checked = value === true;
  return (
    <span
      className="ft-cell-boolean"
      data-checked={checked ? '' : undefined}
      data-editable={editable ? '' : undefined}
      aria-label={String(checked)}
      onClick={editable ? () => edit.change(!checked) : undefined}
    >
      {checked ? CHECKED : UNCHECKED}
    </span>
  );
}
