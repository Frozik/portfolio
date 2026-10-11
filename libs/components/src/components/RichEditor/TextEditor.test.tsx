import { fireEvent, render } from '@testing-library/react';
import { useState } from 'react';

import { editorOf, focusEditor, typeInto } from './editor-test-helpers.test-helper';
import { TextEditor } from './TextEditor';
import styles from './styles.module.css';

function ControlledText({ onValueChange }: { readonly onValueChange: (value: string) => void }) {
  const [value, setValue] = useState('Scans');
  const handleChange = (next: string) => {
    setValue(next);
    onValueChange(next);
  };
  return <TextEditor aria-label="Tab name" value={value} onValueChange={handleChange} />;
}

describe('TextEditor', () => {
  it('sits in the family frame and brings back the value it had on focus on Escape', () => {
    const onValueChange = vi.fn();
    const { container } = render(<ControlledText onValueChange={onValueChange} />);
    const editor = editorOf(container);

    expect(editor.className).toContain(styles.editor);
    focusEditor(editor);
    typeInto(editor, { data: 's', selection: { start: 5, end: 5 } });
    expect(onValueChange).toHaveBeenLastCalledWith('Scanss');
    fireEvent.keyDown(editor, { key: 'Escape' });

    expect(onValueChange).toHaveBeenLastCalledWith('Scans');
  });
});
