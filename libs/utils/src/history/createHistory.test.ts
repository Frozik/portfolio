import { describe, expect, it } from 'vitest';

import { createHistory } from './createHistory';

describe('createHistory', () => {
  it('reports nothing to undo or redo when empty', () => {
    const history = createHistory<string>();

    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
    expect(history.undo('current')).toBeUndefined();
    expect(history.redo('current')).toBeUndefined();
  });

  it('returns pushed snapshots in reverse order', () => {
    const history = createHistory<string>();

    history.push('first');
    history.push('second');

    expect(history.undo('third')).toBe('second');
    expect(history.undo('second')).toBe('first');
    expect(history.canUndo()).toBe(false);
  });

  it('replays undone snapshots forward', () => {
    const history = createHistory<string>();

    history.push('first');
    history.push('second');
    history.undo('third');
    history.undo('second');

    expect(history.canRedo()).toBe(true);
    expect(history.redo('first')).toBe('second');
    expect(history.redo('second')).toBe('third');
    expect(history.canRedo()).toBe(false);
  });

  it('drops the redo stack once a new snapshot is pushed', () => {
    const history = createHistory<string>();

    history.push('first');
    history.undo('second');
    expect(history.canRedo()).toBe(true);

    history.push('first');

    expect(history.canRedo()).toBe(false);
    expect(history.redo('edited')).toBeUndefined();
  });

  it('keeps only the newest snapshots once the limit is exceeded', () => {
    const history = createHistory<number>({ limit: 2 });

    history.push(1);
    history.push(2);
    history.push(3);

    expect(history.undo(4)).toBe(3);
    expect(history.undo(3)).toBe(2);
    expect(history.canUndo()).toBe(false);
  });

  it('forgets both stacks on clear', () => {
    const history = createHistory<string>();

    history.push('first');
    history.undo('second');
    history.clear();

    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });

  it('preserves snapshot identity', () => {
    const snapshot = { value: 1 };
    const history = createHistory<{ readonly value: number }>();

    history.push(snapshot);

    expect(history.undo({ value: 2 })).toBe(snapshot);
  });
});
