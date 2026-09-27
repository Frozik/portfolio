import type { ChangeEvent, KeyboardEvent } from 'react';
import { useRef } from 'react';
import { useEventCallback } from 'usehooks-ts';

import type { IEditorProps } from '../editing-column';
import { useEditorFocus } from './useEditorFocus';

const ROWS = 4;

/** Multi-line text under the cell; Enter adds a line, Ctrl/⌘+Enter commits. */
export function TextareaEditor<TRow>({
  draft,
  onChange,
  commit,
  options,
}: IEditorProps<TRow, string>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEditorFocus(ref);
  const handleChange = useEventCallback((event: ChangeEvent<HTMLTextAreaElement>) =>
    onChange(event.target.value)
  );
  const handleKeyDown = useEventCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      commit();
    } else if (event.key === 'Enter') {
      event.stopPropagation();
    }
  });
  return (
    <textarea
      ref={ref}
      className="ft-editor-textarea"
      rows={ROWS}
      maxLength={options.maxLength}
      value={draft ?? ''}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
    />
  );
}
