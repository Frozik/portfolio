import { render } from '@testing-library/react';
import { useState } from 'react';

import { defineMaskedEditorTools } from './editor-agent-tools';
import { editorOf, focusEditor, typeInto } from './editor-test-helpers.test-helper';
import { MASKS } from './masked-input';
import { MaskedEditor } from './MaskedEditor';

function ControlledMasked({
  initial,
  onValueChange,
}: {
  readonly initial: string;
  readonly onValueChange: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const handleChange = (next: string) => {
    setValue(next);
    onValueChange(next);
  };
  return <MaskedEditor value={value} onValueChange={handleChange} mask={MASKS.iban} />;
}

describe('MaskedEditor', () => {
  it('stores the bare characters and shows them in groups', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <ControlledMasked initial="DE8937" onValueChange={onValueChange} />
    );
    const editor = editorOf(container);

    typeInto(editor, { data: 'o4', selection: { start: 6, end: 6 } });

    expect(onValueChange).toHaveBeenLastCalledWith('DE8937O4');
    expect(editor.textContent).toBe('DE8937O4');
    expect(editor.querySelectorAll('span')).toHaveLength(1);
  });

  it('refuses a character the mask does not take', () => {
    const onValueChange = vi.fn();
    const { container } = render(<ControlledMasked initial="DE89" onValueChange={onValueChange} />);

    typeInto(editorOf(container), { data: '-', selection: { start: 4, end: 4 } });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('puts the value back on Escape', () => {
    const onValueChange = vi.fn();
    const { container } = render(<ControlledMasked initial="DE89" onValueChange={onValueChange} />);
    const editor = editorOf(container);
    focusEditor(editor);

    typeInto(editor, { data: '3', selection: { start: 4, end: 4 } });
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(onValueChange).toHaveBeenLastCalledWith('DE89');
  });

  it('lets an agent read and type through the same mask', async () => {
    let stored = '';
    const [read, enter] = defineMaskedEditorTools({
      name: 'iban',
      label: 'IBAN',
      getValue: () => stored,
      setValue: value => {
        stored = value;
      },
      mask: MASKS.iban,
      accepts: 'letters and digits, up to 34',
    });

    const signal = new AbortController().signal;

    expect(await enter?.run({ text: 'gb82 west 1234 5698 7654 32' }, signal)).toEqual({
      value: 'GB82WEST12345698765432',
    });
    expect(await read?.run({}, signal)).toEqual({ value: 'GB82WEST12345698765432' });
  });

  it('keeps a secret number from other password managers and Grammarly, and plain numbers alone', () => {
    const secret = render(<MaskedEditor value="4111" mask={MASKS.digits} secret />);
    const plain = render(<MaskedEditor value="4111" mask={MASKS.digits} />);

    expect(editorOf(secret.container).getAttribute('data-1p-ignore')).toBe('true');
    expect(editorOf(secret.container).getAttribute('data-gramm')).toBe('false');
    expect(editorOf(plain.container).hasAttribute('data-1p-ignore')).toBe(false);
  });
});
