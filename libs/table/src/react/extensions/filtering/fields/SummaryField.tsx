import type { MouseEvent } from 'react';
import { useEventCallback } from 'usehooks-ts';

/** A read-only chip standing in for a model the row field cannot edit; click opens the editor. */
export function SummaryField({
  text,
  placeholder,
  onOpen,
}: {
  readonly text: string | undefined;
  readonly placeholder: string;
  readonly onOpen: (anchor: HTMLElement) => void;
}) {
  const handleClick = useEventCallback((event: MouseEvent<HTMLButtonElement>) =>
    onOpen(event.currentTarget)
  );
  return (
    <button
      type="button"
      className="ft-filter-field ft-filter-chip"
      data-empty={text === undefined ? '' : undefined}
      onClick={handleClick}
    >
      <span className="ft-filter-chip-text">{text ?? placeholder}</span>
    </button>
  );
}
