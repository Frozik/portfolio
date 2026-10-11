import { fireEvent, render, screen } from '@testing-library/react';

import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('is a labelled native checkbox that reports its new state', () => {
    const onCheckedChange = vi.fn();
    render(
      <Checkbox checked={false} onCheckedChange={onCheckedChange}>
        Hidden network
      </Checkbox>
    );

    fireEvent.click(screen.getByLabelText('Hidden network'));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('does nothing while disabled', () => {
    const onCheckedChange = vi.fn();
    render(
      <Checkbox checked onCheckedChange={onCheckedChange} disabled>
        Locked
      </Checkbox>
    );

    expect(screen.getByLabelText('Locked')).toHaveProperty('disabled', true);
  });
});
