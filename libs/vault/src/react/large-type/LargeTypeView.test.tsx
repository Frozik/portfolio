import { render, screen } from '@testing-library/react';

import { LargeTypeView } from './LargeTypeView';

describe('LargeTypeView', () => {
  it('writes every character in its own numbered cell, an emoji as one', () => {
    render(<LargeTypeView value="a1 😀" aria-label="Password" />);

    const cells = screen.getAllByRole('listitem');
    expect(cells.map(cell => cell.textContent)).toEqual(['a1', '12', '␣3', '😀4']);
  });
});
