import { describe, expect, it, vi } from 'vitest';

import { DisposableBag } from './DisposableBag';

describe('DisposableBag', () => {
  it('runs teardown in LIFO order', () => {
    const calls: string[] = [];
    const bag = new DisposableBag();

    bag.add(() => calls.push('first'));
    bag.add(() => calls.push('second'));
    bag.add(() => calls.push('third'));
    bag.disposeAll();

    expect(calls).toEqual(['third', 'second', 'first']);
  });

  it('is idempotent — a repeated disposeAll runs nothing', () => {
    const dispose = vi.fn();
    const bag = new DisposableBag();

    bag.add(dispose);
    bag.disposeAll();
    bag.disposeAll();

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('does nothing when empty', () => {
    const bag = new DisposableBag();
    expect(() => bag.disposeAll()).not.toThrow();
  });

  it('collects a fresh scope after disposeAll without re-running the old one', () => {
    const previousScope = vi.fn();
    const nextScope = vi.fn();
    const bag = new DisposableBag();

    bag.add(previousScope);
    bag.disposeAll();

    bag.add(nextScope);
    bag.disposeAll();

    expect(previousScope).toHaveBeenCalledTimes(1);
    expect(nextScope).toHaveBeenCalledTimes(1);
  });

  it('does not re-run a disposer that re-enters disposeAll', () => {
    const calls: string[] = [];
    const bag = new DisposableBag();

    bag.add(() => calls.push('outer'));
    bag.add(() => {
      calls.push('reentrant');
      bag.disposeAll();
    });
    bag.disposeAll();

    expect(calls).toEqual(['reentrant', 'outer']);
  });

  it('runs a teardown registered during teardown on the next disposeAll', () => {
    const late = vi.fn();
    const bag = new DisposableBag();

    bag.add(() => {
      bag.add(late);
    });
    bag.disposeAll();
    expect(late).not.toHaveBeenCalled();

    bag.disposeAll();
    expect(late).toHaveBeenCalledTimes(1);
  });
});
