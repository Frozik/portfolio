import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

import { MultilineEditor } from './MultilineEditor';

function ControlledNote({ onValueChange }: { readonly onValueChange: (value: string) => void }) {
  const [value, setValue] = useState('first line');
  const handleChange = (next: string) => {
    setValue(next);
    onValueChange(next);
  };
  return (
    <>
      <MultilineEditor value={value} onValueChange={handleChange} aria-label="Notes" />
      <button type="button">after</button>
    </>
  );
}

const notes = (): HTMLTextAreaElement => screen.getByLabelText('Notes');

describe('MultilineEditor', () => {
  it('keeps line breaks and never offers its text to a spell checker', () => {
    const onValueChange = vi.fn();
    render(<ControlledNote onValueChange={onValueChange} />);

    fireEvent.change(notes(), { target: { value: 'first line\nsecond line' } });

    expect(onValueChange).toHaveBeenLastCalledWith('first line\nsecond line');
    expect(notes().getAttribute('spellcheck')).toBe('false');
    expect(notes().getAttribute('data-gramm')).toBe('false');
  });

  it('moves on with Ctrl+Enter and puts the text back on Escape', () => {
    const onValueChange = vi.fn();
    render(<ControlledNote onValueChange={onValueChange} />);

    act(() => notes().focus());
    fireEvent.change(notes(), { target: { value: 'changed' } });
    fireEvent.keyDown(notes(), { key: 'Escape' });
    expect(onValueChange).toHaveBeenLastCalledWith('first line');

    act(() => notes().focus());
    fireEvent.keyDown(notes(), { key: 'Enter', ctrlKey: true });
    expect(document.activeElement?.textContent).toBe('after');
  });
});
