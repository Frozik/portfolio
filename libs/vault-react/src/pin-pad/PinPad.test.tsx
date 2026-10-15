import { fireEvent, render, screen } from '@testing-library/react';

import { PinPad } from './PinPad';

function aPad(length = 4, disabled = false) {
  const completed: string[] = [];
  render(
    <PinPad
      length={length}
      locale="en"
      disabled={disabled}
      onComplete={digits => completed.push(digits)}
    />
  );
  return { completed, pad: screen.getByTestId('pin-pad') };
}

describe('the PIN pad', () => {
  it('sends the PIN the moment its last digit is typed, and starts empty again', () => {
    const { completed, pad } = aPad();

    ['1', '2', '3', '4'].forEach(key => fireEvent.keyDown(pad, { key }));

    expect(completed).toEqual(['1234']);
    expect(screen.getByRole('status').dataset.entered).toBe('0');
  });

  it('takes digits from its own keys too', () => {
    const { completed } = aPad();

    ['9', '8', '7', '6'].forEach(digit =>
      fireEvent.click(screen.getByRole('button', { name: digit }))
    );

    expect(completed).toEqual(['9876']);
  });

  it('erases the last digit with Backspace', () => {
    const { completed, pad } = aPad();

    ['1', '2', '9'].forEach(key => fireEvent.keyDown(pad, { key }));
    fireEvent.keyDown(pad, { key: 'Backspace' });
    ['3', '4'].forEach(key => fireEvent.keyDown(pad, { key }));

    expect(completed).toEqual(['1234']);
  });

  it('takes nothing while disabled', () => {
    const { completed, pad } = aPad(4, true);

    ['1', '2', '3', '4'].forEach(key => fireEvent.keyDown(pad, { key }));

    expect(completed).toEqual([]);
  });
});
