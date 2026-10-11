import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

import { MultiSelect } from './MultiSelect';

const GROUPS = [
  { value: 'finance', label: 'Finance' },
  { value: 'family', label: 'Family' },
  { value: 'work', label: 'Work' },
] as const;

type TGroup = (typeof GROUPS)[number]['value'];

function Groups({ onGroups }: { readonly onGroups: (values: readonly TGroup[]) => void }) {
  const [values, setValues] = useState<readonly TGroup[]>(['work']);
  const handleChange = (next: readonly TGroup[]) => {
    setValues(next);
    onGroups(next);
  };
  return (
    <MultiSelect
      aria-label="Groups"
      options={GROUPS}
      values={values}
      onValuesChange={handleChange}
    />
  );
}

const field = () => screen.getByRole('combobox', { name: 'Groups' });

describe('MultiSelect', () => {
  it('ticks and clears options with the keyboard while the list stays open', () => {
    const onGroups = vi.fn();
    render(<Groups onGroups={onGroups} />);
    act(() => field().focus());

    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    fireEvent.keyDown(field(), { key: ' ' });
    expect(onGroups).toHaveBeenLastCalledWith(['work', 'finance']);

    fireEvent.keyDown(field(), { key: 'End' });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(onGroups).toHaveBeenLastCalledWith(['finance']);
    expect(field().getAttribute('aria-expanded')).toBe('true');

    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(field().getAttribute('aria-expanded')).toBe('false');
    expect(field().textContent).toContain('Finance');
  });

  it('marks the chosen options in a list that admits several', () => {
    render(<Groups onGroups={vi.fn()} />);

    fireEvent.click(field());
    fireEvent.click(screen.getByRole('option', { name: 'Family' }));

    expect(screen.getByRole('listbox').getAttribute('aria-multiselectable')).toBe('true');
    expect(
      screen
        .getAllByRole('option')
        .filter(option => option.getAttribute('aria-selected') === 'true')
        .map(option => option.textContent)
    ).toEqual(['Family', 'Work']);
    expect(field().textContent).toContain('Family, Work');
  });
});
