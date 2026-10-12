import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

import { pretendCoarsePointer } from '../../hooks/coarse-pointer.test-helper';
import { Select } from './Select';

const COUNTRIES = [
  { value: 'de', label: 'Germany' },
  { value: 'fr', label: 'France', disabled: true },
  { value: 'gb', label: 'United Kingdom' },
  { value: 'us', label: 'United States' },
] as const;

type TCountry = (typeof COUNTRIES)[number]['value'];

function Country({ onCountry }: { readonly onCountry: (value: TCountry) => void }) {
  const [value, setValue] = useState<TCountry | undefined>(undefined);
  const handleChange = (next: TCountry) => {
    setValue(next);
    onCountry(next);
  };
  return (
    <Select
      aria-label="Country"
      placeholder="Choose"
      options={COUNTRIES}
      value={value}
      onValueChange={handleChange}
    />
  );
}

const field = () => screen.getByRole('combobox', { name: 'Country' });

function activeOption(): string | null | undefined {
  const id = field().getAttribute('aria-activedescendant');
  return id === null ? null : document.getElementById(id)?.textContent;
}

/** Radix starts listening for presses outside a tick after the popup opens, so the opening press is not one. */
async function listeningForOutsidePresses(): Promise<void> {
  await act(() => new Promise(resolve => setTimeout(resolve, 0)));
}

describe('Select', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens with the arrow keys, skips disabled options and takes the active one on Enter', () => {
    const onCountry = vi.fn();
    render(<Country onCountry={onCountry} />);
    act(() => field().focus());

    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    expect(field().getAttribute('aria-expanded')).toBe('true');
    expect(activeOption()).toBe('Germany');

    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    expect(activeOption()).toBe('United Kingdom');

    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(onCountry).toHaveBeenLastCalledWith('gb');
    expect(field().getAttribute('aria-expanded')).toBe('false');
    expect(field().textContent).toContain('United Kingdom');
  });

  it('jumps to the option typed and closes on Escape without a change', () => {
    const onCountry = vi.fn();
    render(<Country onCountry={onCountry} />);
    act(() => field().focus());

    fireEvent.keyDown(field(), { key: 'Enter' });
    fireEvent.keyDown(field(), { key: 'u' });
    fireEvent.keyDown(field(), { key: 'n' });
    expect(activeOption()).toBe('United Kingdom');

    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(field().getAttribute('aria-expanded')).toBe('false');
    expect(onCountry).not.toHaveBeenCalled();
    expect(field().textContent).toContain('Choose');
  });

  it('takes an option clicked in the list', () => {
    const onCountry = vi.fn();
    render(<Country onCountry={onCountry} />);

    fireEvent.click(field());
    fireEvent.click(screen.getByRole('option', { name: 'United States' }));
    expect(onCountry).toHaveBeenLastCalledWith('us');

    fireEvent.click(field());
    fireEvent.click(screen.getByRole('option', { name: 'France' }));
    expect(onCountry).toHaveBeenCalledTimes(1);
  });

  it('closes on a click outside even when the click on the field did not focus it, as in Safari', async () => {
    render(
      <>
        <Country onCountry={vi.fn()} />
        <p data-testid="elsewhere">elsewhere</p>
      </>
    );

    fireEvent.click(field());
    expect(field().getAttribute('aria-expanded')).toBe('true');
    await listeningForOutsidePresses();

    fireEvent.pointerDown(screen.getByTestId('elsewhere'));
    fireEvent.click(screen.getByTestId('elsewhere'));
    expect(field().getAttribute('aria-expanded')).toBe('false');
  });

  it('closes when the field is clicked again, without opening anew', async () => {
    render(<Country onCountry={vi.fn()} />);

    fireEvent.click(field());
    await listeningForOutsidePresses();
    fireEvent.pointerDown(field());
    fireEvent.click(field());

    expect(field().getAttribute('aria-expanded')).toBe('false');
  });

  it('rises as a sheet on touch and closes it with the choice', () => {
    pretendCoarsePointer();
    const onCountry = vi.fn();
    render(<Country onCountry={onCountry} />);

    fireEvent.click(field());
    const sheet = document.querySelector('dialog');
    expect(sheet?.open).toBe(true);

    fireEvent.click(screen.getByRole('option', { name: 'Germany' }));
    expect(onCountry).toHaveBeenLastCalledWith('de');
    expect(sheet?.open).toBe(false);
  });

  it('lists options under their group headings and shows the chosen one’s picture in the field', () => {
    const onFruit = vi.fn();
    render(
      <Select
        aria-label="Fruit"
        options={[
          { value: 'none', label: 'None' },
          { value: 'apple', label: 'Apple', group: 'Pome', decoration: <i data-testid="apple" /> },
          { value: 'pear', label: 'Pear', group: 'Pome' },
          { value: 'plum', label: 'Plum', group: 'Stone fruit' },
        ]}
        value="apple"
        onValueChange={onFruit}
      />
    );
    const fruit = screen.getByRole('combobox', { name: 'Fruit' });

    expect(fruit.querySelector('[data-testid="apple"]')).not.toBeNull();
    fireEvent.click(fruit);
    const pome = screen.getByRole('group', { name: 'Pome' });
    expect([...pome.querySelectorAll('[role="option"]')].map(option => option.textContent)).toEqual(
      ['Apple', 'Pear']
    );
    expect(screen.getByRole('group', { name: 'Stone fruit' })).toBeDefined();
    fireEvent.keyDown(fruit, { key: 'ArrowDown' });
    fireEvent.keyDown(fruit, { key: 'Enter' });

    expect(onFruit).toHaveBeenLastCalledWith('pear');
  });

  it('shows only its icon when it is a command, named for assistive technology', () => {
    const onPick = vi.fn();
    render(
      <Select
        aria-label="New card"
        icon={<i data-testid="plus" />}
        options={[{ value: 'login', label: 'Login' }]}
        value={undefined}
        onValueChange={onPick}
      />
    );
    const field = screen.getByRole('combobox', { name: 'New card' });

    expect(field.querySelector('[data-testid="plus"]')).not.toBeNull();
    expect(field.textContent).toBe('');
    expect(field.getAttribute('title')).toBe('New card');
    fireEvent.click(field);
    fireEvent.click(screen.getByRole('option', { name: 'Login' }));

    expect(onPick).toHaveBeenCalledWith('login');
  });
});
