import { useCallback, useEffect, useRef, useState } from 'react';

export interface IWakeLockOptions {
  onError?: (error: Error) => void;
  onRequest?: () => void;
  onRelease?: EventListener;
}

export function useWakeLock({ onError, onRequest, onRelease }: IWakeLockOptions | undefined = {}) {
  const [released, setReleased] = useState<boolean | undefined>();
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  // The request still in flight. `release` and unmount clear it, and a lock
  // arriving for a request that is no longer the pending one is dropped at
  // once — otherwise an effect cleanup racing its own request (StrictMode, a
  // quick unmount) would leak a lock nobody holds a reference to.
  const pendingRequest = useRef<symbol | null>(null);

  // https://caniuse.com/mdn-api_wakelock
  const isSupported = typeof window !== 'undefined' && 'wakeLock' in navigator;

  const request = useCallback(
    async (type: WakeLockType = 'screen') => {
      const isWakeLockAlreadyDefined = wakeLock.current != null || pendingRequest.current != null;
      if (!isSupported) {
        // oxlint-disable-next-line no-console -- intentional user-facing warning
        return console.warn(
          "Calling the `request` function has no effect, Wake Lock Screen API isn't supported"
        );
      }
      if (isWakeLockAlreadyDefined) {
        // oxlint-disable-next-line no-console -- intentional user-facing warning
        return console.warn('Calling `request` multiple times without `release` has no effect');
      }

      const requestToken = Symbol('wake lock request');
      pendingRequest.current = requestToken;

      try {
        const sentinel = await navigator.wakeLock.request(type);

        if (pendingRequest.current !== requestToken) {
          await sentinel.release();
          return;
        }
        pendingRequest.current = null;
        wakeLock.current = sentinel;

        wakeLock.current.onrelease = (e: Event) => {
          // Default to `true` - `released` API is experimental: https://caniuse.com/mdn-api_wakelocksentinel_released
          setReleased(wakeLock.current?.released || true);
          onRelease?.(e);
          wakeLock.current = null;
        };

        onRequest?.();
        setReleased(wakeLock.current?.released || false);
      } catch (error) {
        if (pendingRequest.current === requestToken) {
          pendingRequest.current = null;
        }
        onError?.(error as Error);
      }
    },
    [isSupported, onRequest, onError, onRelease]
  );

  const release = useCallback(async () => {
    if (!isSupported) {
      // oxlint-disable-next-line no-console -- intentional user-facing warning
      return console.warn(
        "Calling the `release` function has no effect, Wake Lock Screen API isn't supported"
      );
    }

    if (pendingRequest.current != null) {
      pendingRequest.current = null;
      return;
    }

    await wakeLock.current?.release();
  }, [isSupported]);

  // Release any acquired wake lock when the component unmounts, otherwise the
  // sentinel keeps the screen awake forever after the consumer is gone.
  useEffect(() => {
    return () => {
      const sentinel = wakeLock.current;
      if (sentinel != null && !sentinel.released) {
        void sentinel.release();
      }
      wakeLock.current = null;
      pendingRequest.current = null;
    };
  }, []);

  return {
    isSupported,
    request,
    released,
    release,
    type: wakeLock.current?.type || undefined,
  };
}
