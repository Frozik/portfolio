import { useRef } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { RichEditor } from '@frozik/components/components/RichEditor/components/RichEditor';
import type { IRichEditorHandle } from '@frozik/components/components/RichEditor/defs';

import type { IEditorProps } from '../editing-column';
import { useEditorFocus } from './useEditorFocus';

export function TextEditor<TRow>({
  draft,
  initialKey,
  validation,
  onChange,
  cancel,
}: IEditorProps<TRow, string>) {
  const ref = useRef<IRichEditorHandle>(null);
  useEditorFocus(ref);
  const started = useRef(false);
  if (!started.current) {
    started.current = true;
    if (initialKey !== undefined) {
      onChange(initialKey === 'Backspace' || initialKey === 'Delete' ? '' : initialKey);
    }
  }
  const handleChange = useEventCallback((value: string) => onChange(value));
  return (
    <RichEditor
      ref={ref}
      className="ft-editor-field"
      value={draft ?? ''}
      onValueChange={handleChange}
      onCancel={cancel}
      aria-invalid={validation?.level === 'error'}
      enterKeyHint="done"
    />
  );
}
