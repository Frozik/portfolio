import type { ICellContext } from '../column';

const CHECKED = '✓';
const UNCHECKED = '–';

export function BooleanCell<TRow>({ value }: ICellContext<TRow>) {
  const checked = value === true;
  return (
    <span
      className="ft-cell-boolean"
      data-checked={checked ? '' : undefined}
      aria-label={String(checked)}
    >
      {checked ? CHECKED : UNCHECKED}
    </span>
  );
}
