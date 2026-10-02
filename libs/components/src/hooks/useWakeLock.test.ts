import { act, renderHook } from '@testing-library/react';
import { StrictMode, useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useWakeLock } from './useWakeLock';

interface IFakeSentinel {
  released: boolean;
  onrelease: ((event: Event) => void) | null;
  readonly release: () => Promise<void>;
}

function createFakeSentinel(): IFakeSentinel {
  const sentinel: IFakeSentinel = {
    released: false,
    onrelease: null,
    release: async () => {
      sentinel.released = true;
      sentinel.onrelease?.(new Event('release'));
    },
  };
  return sentinel;
}

describe('useWakeLock', () => {
  const sentinels: IFakeSentinel[] = [];
  const warn = vi.spyOn(console, 'warn');

  beforeEach(() => {
    sentinels.length = 0;
    warn.mockReset();
    vi.stubGlobal('navigator', {
      wakeLock: {
        request: async () => {
          const sentinel = createFakeSentinel();
          sentinels.push(sentinel);
          return sentinel;
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('holds the lock after a request and drops it on release', async () => {
    const { result } = renderHook(() => useWakeLock());

    await act(() => result.current.request());
    expect(sentinels.map(({ released }) => released)).toEqual([false]);

    await act(() => result.current.release());
    expect(sentinels.map(({ released }) => released)).toEqual([true]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('quietly drops a lock released while its request is still in flight', async () => {
    const { result } = renderHook(() => useWakeLock());

    await act(async () => {
      const pending = result.current.request();
      await result.current.release();
      await pending;
    });

    expect(sentinels.map(({ released }) => released)).toEqual([true]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps only the latest lock when a request is cancelled and repeated at once', async () => {
    const { result } = renderHook(() => useWakeLock());

    await act(async () => {
      const first = result.current.request();
      await result.current.release();
      await Promise.all([first, result.current.request()]);
    });

    expect(sentinels.map(({ released }) => released)).toEqual([true, false]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('drops a lock that arrives after the consumer has unmounted', async () => {
    const { result, unmount } = renderHook(() => useWakeLock());

    const pending = result.current.request();
    unmount();
    await pending;

    expect(sentinels.map(({ released }) => released)).toEqual([true]);
  });

  it('treats a release with nothing requested as a quiet no-op', async () => {
    const { result } = renderHook(() => useWakeLock());

    await act(() => result.current.release());

    expect(warn).not.toHaveBeenCalled();
  });

  it('holds exactly one lock, without warnings, under StrictMode effect replay', async () => {
    await act(async () => {
      renderHook(
        () => {
          const { request, release } = useWakeLock();

          useEffect(() => {
            void request();
            return () => void release();
          }, [request, release]);
        },
        { wrapper: StrictMode }
      );
    });

    expect(sentinels.filter(({ released }) => !released)).toHaveLength(1);
    expect(warn).not.toHaveBeenCalled();
  });
});
