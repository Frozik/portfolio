import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Temporal } from 'temporal-polyfill';

import { pretendCoarsePointer } from '../../hooks/coarse-pointer.test-helper';
import { focusEditor, typeInto } from './editor-test-helpers.test-helper';
import { MonthYearEditor } from './MonthYearEditor';

function Expiry({
  initial,
  onExpiry,
}: {
  readonly initial: Temporal.PlainYearMonth | undefined;
  readonly onExpiry: (value: Temporal.PlainYearMonth | undefined) => void;
}) {
  const [value, setValue] = useState(initial);
  const handleChange = (next: Temporal.PlainYearMonth | undefined) => {
    setValue(next);
    onExpiry(next);
  };
  return <MonthYearEditor aria-label="Expiry" value={value} onValueChange={handleChange} />;
}

const field = () => screen.getByRole('textbox', { name: 'Expiry' });

describe('MonthYearEditor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('commits a month once four digits are typed and flags a month past twelve', () => {
    const onExpiry = vi.fn();
    render(<Expiry initial={undefined} onExpiry={onExpiry} />);

    typeInto(field(), { data: '1229', selection: { start: 0, end: 0 } });
    expect(field().textContent).toBe('12/29');
    expect(onExpiry).toHaveBeenLastCalledWith(
      Temporal.PlainYearMonth.from({ year: 2029, month: 12 })
    );

    typeInto(field(), { data: '1329', selection: { start: 0, end: 5 } });
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(onExpiry).toHaveBeenCalledTimes(1);
  });

  it('takes a month picked in the popup of the value’s year', () => {
    const onExpiry = vi.fn();
    render(
      <Expiry
        initial={Temporal.PlainYearMonth.from({ year: 2029, month: 3 })}
        onExpiry={onExpiry}
      />
    );

    focusEditor(field());
    expect(screen.getByRole('button', { name: 'March 2029' }).getAttribute('aria-pressed')).toBe(
      'true'
    );
    fireEvent.click(screen.getByRole('button', { name: 'December 2029' }));

    expect(onExpiry).toHaveBeenLastCalledWith(
      Temporal.PlainYearMonth.from({ year: 2029, month: 12 })
    );
    expect(field().textContent).toBe('12/29');
  });

  it('follows a typed year in the popup', () => {
    render(<Expiry initial={undefined} onExpiry={vi.fn()} />);

    typeInto(field(), { data: '0531', selection: { start: 0, end: 0 } });

    expect(screen.getByRole('button', { name: 'May 2031' }).getAttribute('aria-pressed')).toBe(
      'true'
    );
  });

  it('offers no month popup on touch, where the numeric keyboard is quicker', () => {
    pretendCoarsePointer();
    render(<Expiry initial={undefined} onExpiry={vi.fn()} />);

    focusEditor(field());

    expect(screen.queryByRole('group', { name: 'Choose a month' })).toBeNull();
  });
});
