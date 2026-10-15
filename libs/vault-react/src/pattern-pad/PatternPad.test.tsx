import { assert } from '@frozik/utils/assert/assert';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { PatternPad } from './PatternPad';

function aPad(hideLine = false) {
  const completed: (readonly number[])[] = [];
  render(
    <PatternPad locale="en" hideLine={hideLine} onComplete={points => completed.push(points)} />
  );
  const points = within(screen.getByTestId('pattern-pad')).getAllByRole('button');
  const point = (index: number): HTMLElement => {
    const found = points[index];
    assert(found !== undefined);
    return found;
  };
  return { completed, points, point };
}

describe('the pattern pad', () => {
  it('draws a pattern with the keyboard: arrows move, Space joins, Enter finishes', () => {
    const { completed, points, point } = aPad();
    point(0).focus();

    fireEvent.keyDown(point(0), { key: ' ' });
    fireEvent.keyDown(point(0), { key: 'ArrowRight' });
    fireEvent.keyDown(point(1), { key: ' ' });
    fireEvent.keyDown(point(1), { key: 'ArrowDown' });
    fireEvent.keyDown(point(4), { key: ' ' });
    fireEvent.keyDown(point(4), { key: 'ArrowDown' });
    fireEvent.keyDown(point(7), { key: ' ' });
    fireEvent.keyDown(point(7), { key: 'Enter' });

    expect(completed).toEqual([[0, 1, 4, 7]]);
    expect(points.every(point => point.dataset.state === 'free')).toBe(true);
  });

  it('shows which points are joined while drawing', () => {
    const { point } = aPad();

    fireEvent.keyDown(point(2), { key: ' ' });

    expect(point(2).dataset.state).toBe('joined');
    expect(point(2).getAttribute('aria-pressed')).toBe('true');
  });

  it('draws no line when the line is hidden', () => {
    aPad(true);

    expect(screen.getByTestId('pattern-pad').dataset.hideLine).toBe('true');
  });

  it('runs the line on from the last point to the pointer while it draws', () => {
    const PAD_SIDE = 240;
    const CELL_SIDE = PAD_SIDE / 3;
    const { points } = aPad();
    const pad = screen.getByTestId('pattern-pad');
    vi.spyOn(pad, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, PAD_SIDE, PAD_SIDE));
    points.forEach((button, index) => {
      vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(
          (index % 3) * CELL_SIDE,
          Math.floor(index / 3) * CELL_SIDE,
          CELL_SIDE,
          CELL_SIDE
        )
      );
    });
    pad.setPointerCapture = () => undefined;

    fireEvent.pointerDown(pad, { clientX: 40, clientY: 40, pointerId: 1 });
    fireEvent.pointerMove(pad, { clientX: 80, clientY: 48, pointerId: 1 });

    expect(screen.getByTestId('pattern-line').getAttribute('points')).toBe('50,50 100,60');
  });
});
