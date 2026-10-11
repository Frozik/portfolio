import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

import { typeInto } from '../RichEditor/editor-test-helpers.test-helper';
import { Combobox } from './Combobox';
import { matchingSuggestions } from './listbox-navigation';

const BANKS = ['Deutsche Bank', 'Commerzbank', 'Chase', 'Bank of America'];

function Bank({ onBank }: { readonly onBank: (value: string) => void }) {
  const [value, setValue] = useState('');
  const handleChange = (next: string) => {
    setValue(next);
    onBank(next);
  };
  return (
    <>
      <Combobox aria-label="Bank" suggestions={BANKS} value={value} onValueChange={handleChange} />
      <button type="button">after</button>
    </>
  );
}

const field = () => screen.getByRole('combobox', { name: 'Bank' });

function type(text: string): void {
  const editor = field();
  typeInto(editor, {
    data: text,
    selection: { start: editor.textContent?.length ?? 0, end: editor.textContent?.length ?? 0 },
  });
}

describe('Combobox', () => {
  it('offers suggestions starting with the typed text before those containing it', () => {
    expect(matchingSuggestions(BANKS, 'ba', 'en')).toEqual([
      'Bank of America',
      'Deutsche Bank',
      'Commerzbank',
    ]);
    expect(matchingSuggestions(BANKS, '  ', 'en')).toEqual(BANKS);
  });

  it('filters the list as the user types and takes the suggestion picked with the arrows', () => {
    const onBank = vi.fn();
    render(<Bank onBank={onBank} />);

    type('c');
    expect(field().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
      'Commerzbank',
      'Chase',
      'Deutsche Bank',
      'Bank of America',
    ]);

    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    fireEvent.keyDown(field(), { key: 'Enter' });

    expect(onBank).toHaveBeenLastCalledWith('Chase');
    expect(field().getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps typed text no suggestion matches, and Escape closes the list before it reverts', () => {
    const onBank = vi.fn();
    render(<Bank onBank={onBank} />);

    type('Q');
    expect(field().getAttribute('aria-expanded')).toBe('false');
    expect(onBank).toHaveBeenLastCalledWith('Q');

    typeInto(field(), { data: 'C', selection: { start: 0, end: 1 } });
    expect(field().getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(field().getAttribute('aria-expanded')).toBe('false');
    expect(onBank).toHaveBeenLastCalledWith('C');
  });
});
