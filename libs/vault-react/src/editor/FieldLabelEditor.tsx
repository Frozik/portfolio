import type { IRichEditorHandle } from '@frozik/components/components/RichEditor/defs';
import { TextEditor } from '@frozik/components/components/RichEditor/TextEditor';
import { useEffect, useRef } from 'react';

import { editorT } from '../texts/editor';

/**
 * A field's label being renamed: focused at once, done on
 * Enter or when focus leaves; Escape brings the old name back, and so does
 * a label left blank.
 */
export function FieldLabelEditor({
  label,
  onRename,
  onDone,
}: {
  readonly label: string;
  readonly onRename: (label: string) => void;
  readonly onDone: () => void;
}) {
  const editor = useRef<IRichEditorHandle>(null);
  const before = useRef(label);

  useEffect(() => {
    editor.current?.focus();
  }, []);

  const handleFocusChange = (focused: boolean) => {
    if (focused) {
      return;
    }
    if (label.trim() === '') {
      onRename(before.current);
    }
    onDone();
  };

  return (
    <div className="min-w-0 flex-1">
      <TextEditor
        ref={editor}
        aria-label={editorT.fieldName}
        value={label}
        onValueChange={onRename}
        onFocusChange={handleFocusChange}
        enterKeyHint="done"
      />
    </div>
  );
}
