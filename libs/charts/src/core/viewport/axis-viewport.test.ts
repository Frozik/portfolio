import { describe, expect, it, vi } from 'vitest';

import type { IAxisRange } from './axis-domain';
import { AxisViewport } from './axis-viewport';
import { numberDomain } from './number-domain';

function createViewport(
  constrain: (range: IAxisRange<number>) => IAxisRange<number> = range => range
) {
  const onChange = vi.fn();
  const viewport = new AxisViewport({
    domain: numberDomain,
    initial: { start: 0, end: 100 },
    constrain,
    onChange,
  });
  return { viewport, onChange };
}

const clampToFirstThousand = (range: IAxisRange<number>): IAxisRange<number> => {
  const span = range.end - range.start;
  const start = Math.min(Math.max(range.start, 0), 1000 - span);
  return { start, end: start + span };
};

describe('the viewport of an axis', () => {
  it('keeps what is drawn until an animator moves it towards the target', () => {
    const { viewport } = createViewport();

    viewport.setTarget({ start: 50, end: 150 });

    expect(viewport.current).toEqual({ start: 0, end: 100 });
    expect(viewport.target).toEqual({ start: 50, end: 150 });
  });

  it('moves the drawn range and the target together on a jump', () => {
    const { viewport } = createViewport();

    viewport.jump({ start: 20, end: 60 });

    expect(viewport.current).toEqual({ start: 20, end: 60 });
    expect(viewport.target).toEqual({ start: 20, end: 60 });
  });

  it('shifts the target by as much as the drawn range really moved against a constraint', () => {
    const { viewport } = createViewport(clampToFirstThousand);
    viewport.setTarget({ start: 10, end: 60 });

    const moved = viewport.shift(-30);

    expect(moved).toBe(0);
    expect(viewport.current).toEqual({ start: 0, end: 100 });
    expect(viewport.target).toEqual({ start: 10, end: 60 });
  });

  it('applies the constraint to targets and jumps but not to what an animator writes', () => {
    const { viewport } = createViewport(clampToFirstThousand);

    viewport.setTarget({ start: 950, end: 1050 });
    viewport.setCurrent({ start: -5, end: 95 });

    expect(viewport.target).toEqual({ start: 900, end: 1000 });
    expect(viewport.current).toEqual({ start: -5, end: 95 });
  });

  it('is held by hand until released, and announces both', () => {
    const { viewport, onChange } = createViewport(clampToFirstThousand);

    viewport.hold({ start: -50, end: 50 });
    expect(viewport.isHeld).toBe(true);
    expect(viewport.current).toEqual({ start: 0, end: 100 });
    expect(onChange).toHaveBeenCalledTimes(1);

    viewport.release();
    expect(viewport.isHeld).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('announces a change once and only when something changed', () => {
    const { viewport, onChange } = createViewport();

    viewport.jump({ start: 0, end: 100 });
    viewport.setTarget({ start: 0, end: 100 });
    expect(onChange).not.toHaveBeenCalled();
    expect(viewport.revision).toBe(0);

    viewport.setTarget({ start: 0, end: 200 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(viewport.revision).toBe(1);
  });
});
