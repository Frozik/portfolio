import type { ICellContext, TCellComponent } from '../column';

/** A cell whose text links somewhere derived from the row; external links open in a new tab. */
export function linkCell<TRow>(options: {
  readonly to: (row: TRow) => string | undefined;
  readonly external?: boolean;
}): TCellComponent<TRow> {
  return function LinkCell({ row, text }: ICellContext<TRow>) {
    const href = options.to(row);
    if (href === undefined) {
      return <span className="ft-cell-text">{text}</span>;
    }
    return (
      <a
        className="ft-cell-text ft-cell-link"
        href={href}
        target={options.external === true ? '_blank' : undefined}
        rel={options.external === true ? 'noreferrer' : undefined}
      >
        {text}
      </a>
    );
  };
}
