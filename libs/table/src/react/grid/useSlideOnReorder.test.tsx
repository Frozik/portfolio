import { render, screen } from '@testing-library/react';
import { useRef } from 'react';

import { useSlideOnReorder } from './useSlideOnReorder';

function Cell({ index }: { readonly index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useSlideOnReorder(ref, index);
  return <div ref={ref} data-testid="cell" />;
}

function harness() {
  const { rerender } = render(<Cell index={0} />);
  const cell = screen.getByTestId('cell');
  cell.style.setProperty('--table-motion', '160ms');
  cell.style.setProperty('--table-easing', 'ease-out');
  const lefts: number[] = [];
  vi.spyOn(cell, 'getBoundingClientRect').mockImplementation(
    () => ({ left: lefts.shift() ?? 0 }) as DOMRect
  );
  const animate = vi.spyOn(cell, 'animate');
  return { cell, lefts, animate, rerender: (index: number) => rerender(<Cell index={index} />) };
}

describe('header cell slide', () => {
  it('slides from where it stood when its place among the columns changes, never on a width change alone', () => {
    const { lefts, animate, rerender } = harness();
    lefts.push(100);
    rerender(0);
    expect(animate).not.toHaveBeenCalled();

    lefts.push(300);
    rerender(2);
    expect(animate).toHaveBeenCalledWith(
      [{ transform: 'translateX(-200px)' }, { transform: 'translateX(0)' }],
      { duration: 160, easing: 'ease-out' }
    );
  });

  it('continues from mid-flight when the columns are reordered again before the slide ends', () => {
    const { lefts, animate, rerender } = harness();
    const cancel = vi.fn();
    animate.mockReturnValue({ playState: 'running', cancel } as unknown as Animation);
    lefts.push(300);
    rerender(2);

    lefts.push(250, 500);
    rerender(3);
    expect(cancel).toHaveBeenCalledOnce();
    expect(animate).toHaveBeenLastCalledWith(
      [{ transform: 'translateX(-250px)' }, { transform: 'translateX(0)' }],
      { duration: 160, easing: 'ease-out' }
    );
  });

  it('stays still under reduced motion', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    const { lefts, animate, rerender } = harness();
    lefts.push(300);
    rerender(2);
    expect(animate).not.toHaveBeenCalled();
  });
});
