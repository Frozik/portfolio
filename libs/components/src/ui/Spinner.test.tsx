import { render } from '@testing-library/react';

import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('sits inside a line of text without breaking the markup', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <p>
        <Spinner size="sm" /> Opening…
      </p>
    );

    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
