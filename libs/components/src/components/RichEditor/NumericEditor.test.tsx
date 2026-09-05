import { fireEvent, render } from '@testing-library/react';
import { useState } from 'react';

import { blurEditor, editorOf, focusEditor, typeInto } from './editor-test-helpers.test-helper';
import { NumericEditor } from './NumericEditor';

function ControlledEditor({
  initial,
  onValueChange,
  decimal,
  step,
  min,
  max,
}: {
  readonly initial: number | undefined;
  readonly onValueChange: (value: number | undefined) => void;
  readonly decimal?: number;
  readonly step?: number;
  readonly min?: number;
  readonly max?: number;
}) {
  const [value, setValue] = useState(initial);
  const handleChange = (next: number | undefined) => {
    setValue(next);
    onValueChange(next);
  };
  return (
    <NumericEditor
      value={value}
      onValueChange={handleChange}
      decimal={decimal}
      step={step}
      min={min}
      max={max}
    />
  );
}

describe('NumericEditor', () => {
  it('emits the typed number and shows the text exactly as typed while focused', () => {
    const onValueChange = vi.fn();
    const { container } = render(<ControlledEditor initial={1} onValueChange={onValueChange} />);
    const editor = editorOf(container);

    typeInto(editor, { data: '5', selection: { start: 1, end: 1 } });

    expect(onValueChange).toHaveBeenLastCalledWith(15);
    expect(editor.textContent).toBe('15');
  });

  it('rejects a letter without touching the value', () => {
    const onValueChange = vi.fn();
    const { container } = render(<ControlledEditor initial={1} onValueChange={onValueChange} />);
    const editor = editorOf(container);

    typeInto(editor, { data: 'x', selection: { start: 1, end: 1 } });

    expect(onValueChange).not.toHaveBeenCalled();
    expect(editor.textContent).toBe('1');
  });

  it('Escape restores the value from before the edit and does not emit the edited one afterwards', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <ControlledEditor initial={1} onValueChange={onValueChange} decimal={2} />
    );
    const editor = editorOf(container);

    typeInto(editor, { data: '.50', selection: { start: 1, end: 1 } });
    expect(onValueChange).toHaveBeenLastCalledWith(1.5);
    fireEvent.keyDown(editor, { key: 'Escape' });

    expect(onValueChange).toHaveBeenLastCalledWith(1);
    expect(editor.textContent).toBe('1.00');
  });

  it('settles to the decimal scale on blur, rounding half up', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <ControlledEditor initial={undefined} onValueChange={onValueChange} decimal={2} />
    );
    const editor = editorOf(container);

    typeInto(editor, { data: '1.005', selection: { start: 0, end: 0 } });
    blurEditor(editor);

    expect(onValueChange).toHaveBeenLastCalledWith(1.01);
    expect(editor.textContent).toBe('1.01');
  });

  it('keeps the value inside its bounds on blur', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <ControlledEditor initial={undefined} onValueChange={onValueChange} min={0} max={10} />
    );
    const editor = editorOf(container);

    typeInto(editor, { data: '42', selection: { start: 0, end: 0 } });
    blurEditor(editor);

    expect(onValueChange).toHaveBeenLastCalledWith(10);
  });

  it('steps with the arrow keys when a step is given', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <ControlledEditor initial={5} onValueChange={onValueChange} step={0.5} max={5.5} />
    );
    const editor = editorOf(container);
    focusEditor(editor);

    fireEvent.keyDown(editor, { key: 'ArrowUp' });
    fireEvent.keyDown(editor, { key: 'ArrowUp' });
    expect(onValueChange).toHaveBeenLastCalledWith(5.5);
    fireEvent.keyDown(editor, { key: 'ArrowDown' });

    expect(onValueChange).toHaveBeenLastCalledWith(5);
  });

  it('does not emit anything on mount', () => {
    const onValueChange = vi.fn();
    render(<ControlledEditor initial={1.999} onValueChange={onValueChange} decimal={2} />);

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('asks the phone for a numeric keyboard', () => {
    const { container } = render(<NumericEditor value={1} decimal={0} />);

    expect(editorOf(container).getAttribute('inputmode')).toBe('numeric');
  });

  it('cannot be focused while disabled', () => {
    const { container } = render(<NumericEditor value={1} disabled />);
    const editor = editorOf(container);

    expect(editor.hasAttribute('tabindex')).toBe(false);
    expect(editor.getAttribute('contenteditable')).toBe('false');
  });
});
