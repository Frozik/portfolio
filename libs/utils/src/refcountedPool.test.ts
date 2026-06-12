import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRefcountedPool } from './refcountedPool';

const GRACE_MS = 100;

describe('createRefcountedPool', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a value once and shares it across concurrent acquires', () => {
    const create = vi.fn(() => ({ id: Math.random() }));
    const pool = createRefcountedPool<{ id: number }>(() => undefined);

    const a = pool.acquire('k', create);
    const b = pool.acquire('k', create);

    expect(a).toBe(b);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('disposes only after the last release plus the grace window', () => {
    const dispose = vi.fn();
    const pool = createRefcountedPool<string>(dispose, GRACE_MS);

    pool.acquire('k', () => 'v');
    pool.acquire('k', () => 'v');

    pool.release('k');
    vi.advanceTimersByTime(GRACE_MS + 1);
    expect(dispose).not.toHaveBeenCalled(); // one consumer still holds it

    pool.release('k');
    vi.advanceTimersByTime(GRACE_MS - 1);
    expect(dispose).not.toHaveBeenCalled(); // grace not elapsed yet

    vi.advanceTimersByTime(2);
    expect(dispose).toHaveBeenCalledExactlyOnceWith('v');
  });

  it('cancels the deferred dispose when re-acquired within the grace window (strict-mode remount)', () => {
    const dispose = vi.fn();
    const create = vi.fn(() => 'v');
    const pool = createRefcountedPool<string>(dispose, GRACE_MS);

    pool.acquire('k', create);
    pool.release('k'); // arms the timer
    const reacquired = pool.acquire('k', create); // cancels it
    vi.advanceTimersByTime(GRACE_MS + 1);

    expect(dispose).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1); // same value reused, not re-created
    expect(reacquired).toBe('v');
  });

  it('re-creates a fresh value after a full teardown', () => {
    const dispose = vi.fn();
    const create = vi.fn(() => ({ tag: 'fresh' }));
    const pool = createRefcountedPool<{ tag: string }>(dispose, GRACE_MS);

    pool.acquire('k', create);
    pool.release('k');
    vi.advanceTimersByTime(GRACE_MS + 1);
    expect(dispose).toHaveBeenCalledTimes(1);

    pool.acquire('k', create);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('keys are independent', () => {
    const dispose = vi.fn();
    const pool = createRefcountedPool<string>(dispose, GRACE_MS);

    pool.acquire('a', () => 'va');
    pool.acquire('b', () => 'vb');
    pool.release('a');
    vi.advanceTimersByTime(GRACE_MS + 1);

    expect(dispose).toHaveBeenCalledExactlyOnceWith('va');
  });

  it('release on an unknown key is a no-op', () => {
    const dispose = vi.fn();
    const pool = createRefcountedPool<string>(dispose, GRACE_MS);

    expect(() => pool.release('missing')).not.toThrow();
    vi.advanceTimersByTime(GRACE_MS + 1);
    expect(dispose).not.toHaveBeenCalled();
  });
});
