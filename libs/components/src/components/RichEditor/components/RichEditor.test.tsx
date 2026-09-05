import { act, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';

import { editorOf, focusEditor, typeInto } from '../editor-test-helpers.test-helper';
import { getElementSelection } from '../selection';
import { RichEditor } from './RichEditor';

function ControlledEditor({
  initial,
  onValueChange,
}: {
  readonly initial: string;
  readonly onValueChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const handleChange = (next: string) => {
    setValue(next);
    onValueChange?.(next);
  };
  return <RichEditor value={value} onValueChange={handleChange} />;
}

describe('RichEditor', () => {
  it('inserts pasted multi-line text as one line', () => {
    const onValueChange = vi.fn();
    const { container } = render(<ControlledEditor initial="" onValueChange={onValueChange} />);
    const editor = editorOf(container);

    typeInto(editor, {
      inputType: 'insertFromPaste',
      data: 'first\nsecond',
      selection: { start: 0, end: 0 },
    });

    expect(onValueChange).toHaveBeenLastCalledWith('first second');
  });

  it('replaces the selected text with the typed character and puts the caret after it', () => {
    const { container } = render(<ControlledEditor initial="abcd" />);
    const editor = editorOf(container);

    typeInto(editor, { data: 'X', selection: { start: 1, end: 3 } });

    expect(editor.textContent).toBe('aXd');
    expect(getElementSelection(editor)).toEqual({ start: 2, end: 2 });
  });

  it('commits composed text once, on compositionend', () => {
    const onValueChange = vi.fn();
    const { container } = render(<ControlledEditor initial="" onValueChange={onValueChange} />);
    const editor = editorOf(container);
    focusEditor(editor);

    act(() => {
      fireEvent.compositionStart(editor);
      editor.textContent = 'ねこ';
      fireEvent.compositionEnd(editor, { data: 'ねこ' });
    });

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith('ねこ');
  });

  it('moves the caret to the end when the value changes from outside while focused', () => {
    function Outer() {
      const [value, setValue] = useState('12');
      return (
        <>
          <RichEditor value={value} onValueChange={setValue} />
          <button type="button" onClick={() => setValue('12345')}>
            grow
          </button>
        </>
      );
    }
    const { container, getByText } = render(<Outer />);
    const editor = editorOf(container);
    typeInto(editor, { data: '0', selection: { start: 1, end: 1 } });
    expect(getElementSelection(editor)).toEqual({ start: 2, end: 2 });

    act(() => {
      getByText('grow').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(editor.textContent).toBe('12345');
    expect(getElementSelection(editor)).toEqual({ start: 5, end: 5 });
  });

  it('shows the placeholder through the data attribute instead of injecting markup', () => {
    const { container } = render(<RichEditor value="" placeholder="<b>type</b>" />);
    const editor = editorOf(container);

    expect(editor.getAttribute('data-placeholder')).toBe('<b>type</b>');
    expect(editor.innerHTML).toBe('');
  });

  it('exposes focus() through its handle', () => {
    let handle: { focus(): void } | null = null;
    const { container } = render(
      <RichEditor
        value=""
        ref={next => {
          handle = next;
        }}
      />
    );

    act(() => {
      handle?.focus();
    });

    expect(document.activeElement).toBe(editorOf(container));
  });
});
