import type { KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import type { IEditorOption, IEditorProps } from '../editing-column';

/** A list under the cell: arrows move, Enter or a click picks and commits. */
export function SelectEditor<TRow>({
  draft,
  row,
  options,
  onChange,
  commit,
  cancel,
}: IEditorProps<TRow>) {
  const values: readonly IEditorOption[] =
    typeof options.values === 'function' ? options.values(row) : (options.values ?? []);
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      values.findIndex(option => Object.is(option.value, draft))
    )
  );
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.focus();
  }, []);

  const pick = useEventCallback((index: number) => {
    const option = values[index];
    if (option !== undefined) {
      onChange(option.value);
      commit();
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
        cancel();
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
      className="ft-editor-list"
      onKeyDown={handleKeyDown}
    >
      {values.map((option, index) => (
        <div
          key={option.label}
          role="option"
          tabIndex={-1}
          aria-selected={Object.is(option.value, draft)}
          className="ft-editor-option"
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
