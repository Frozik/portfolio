import type { ChangeEvent, KeyboardEvent } from 'react';
import { memo, useEffect, useRef } from 'react';
import { useEventCallback } from 'usehooks-ts';

import type { ICellEdit, ICellProps, TCellComponent } from '../column';
import { useFieldFocus } from './useFieldFocus';

export interface ITextareaCellOptions {
  readonly maxLength?: number;
  readonly rows?: number;
}

const DEFAULT_ROWS = 4;

/** Multi-line text under the cell; Enter adds a line, Ctrl/⌘+Enter commits. */
function TextareaField({
  edit,
  options,
}: {
  readonly edit: ICellEdit<string>;
  readonly options: ITextareaCellOptions;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useFieldFocus(ref);
  useEffect(() => {
    ref.current?.select();
  }, []);
  const handleChange = useEventCallback((event: ChangeEvent<HTMLTextAreaElement>) =>
    edit.update(event.target.value)
  );
  const handleKeyDown = useEventCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      edit.commit();
    } else if (event.key === 'Enter') {
      event.stopPropagation();
    }
  });
  return (
    <textarea
      ref={ref}
      className="ft-cell-popup ft-cell-textarea"
      rows={options.rows ?? DEFAULT_ROWS}
      maxLength={options.maxLength}
      value={edit.draft ?? ''}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
    />
  );
}

/** Text in view mode; in edit mode the text stays and a textarea opens under the cell. */
export function textareaCell<TRow>(
  options: ITextareaCellOptions = {}
): TCellComponent<TRow, string> {
  return memo(function TextareaCell({ text, mode, edit }: ICellProps<TRow, string>) {
    return (
      <>
        {text}
        {mode === 'edit' && <TextareaField edit={edit} options={options} />}
      </>
    );
  });
}
