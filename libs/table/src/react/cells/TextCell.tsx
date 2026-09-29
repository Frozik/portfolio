import { useRef } from 'react';

import { RichEditor } from '@frozik/components/components/RichEditor/components/RichEditor';
import type { IRichEditorHandle } from '@frozik/components/components/RichEditor/defs';

import type { ICellEdit, ICellProps } from '../column';
import { selectAllOnFocus } from './selectAllOnFocus';
import { useFieldFocus } from './useFieldFocus';
import { useInitialKey } from './useInitialKey';

const CLEAR_KEYS: ReadonlySet<string> = new Set(['Backspace', 'Delete']);

function TextField({ edit }: { readonly edit: ICellEdit<string> }) {
  const ref = useRef<IRichEditorHandle>(null);
  useFieldFocus(ref);
  useInitialKey(edit, key => (CLEAR_KEYS.has(key) ? '' : key));
  return (
    <RichEditor
      ref={ref}
      className="ft-cell-field"
      value={edit.draft ?? ''}
      onValueChange={edit.update}
      onFocusSelection={selectAllOnFocus}
      onCancel={edit.cancel}
      aria-invalid={edit.validation?.level === 'error'}
      enterKeyHint="done"
    />
  );
}

/** Text in view mode, a single-line field in edit mode; the default of text and custom columns. Generic, so it fits any row type. */
export function TextCell<TRow>({ text, mode, edit }: ICellProps<TRow, string>) {
  return mode === 'edit' ? <TextField edit={edit} /> : text;
}
