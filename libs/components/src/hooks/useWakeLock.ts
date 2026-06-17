import { useCallback, useEffect, useRef, useState } from 'react';

export interface IWakeLockOptions {
  onError?: (error: Error) => void;
  onRequest?: () => void;
  onRelease?: EventListener;
}

export function useWakeLock({ onError, onRequest, onRelease }: IWakeLockOptions | undefined = {}) {
  const [released, setReleased] = useState<boolean | undefined>();
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  // https://caniuse.com/mdn-api_wakelock
  const isSupported = typeof window !== 'undefined' && 'wakeLock' in navigator;

  const request = useCallback(
    async (type: WakeLockType = 'screen') => {
      const isWakeLockAlreadyDefined = wakeLock.current != null;
      if (!isSupported) {
        // biome-ignore lint/suspicious/noConsole: intentional user-facing warning
        return console.warn(
          "Calling the `request` function has no effect, Wake Lock Screen API isn't supported"
        );
      }
      if (isWakeLockAlreadyDefined) {
        // biome-ignore lint/suspicious/noConsole: intentional user-facing warning
        return console.warn('Calling `request` multiple times without `release` has no effect');
      }

      try {
        wakeLock.current = await navigator.wakeLock.request(type);

        wakeLock.current.onrelease = (e: Event) => {
          // Default to `true` - `released` API is experimental: https://caniuse.com/mdn-api_wakelocksentinel_released
          setReleased(wakeLock.current?.released || true);
          onRelease?.(e);
          wakeLock.current = null;
        };

        onRequest?.();
        setReleased(wakeLock.current?.released || false);
      } catch (error) {
        onError?.(error as Error);
      }
    },
    [isSupported, onRequest, onError, onRelease]
  );

  const release = useCallback(async () => {
    const isWakeLockUndefined = wakeLock.current == null;
    if (!isSupported) {
      // biome-ignore lint/suspicious/noConsole: intentional user-facing warning
      return console.warn(
        "Calling the `release` function has no effect, Wake Lock Screen API isn't supported"
      );
    }

    if (isWakeLockUndefined) {
      // biome-ignore lint/suspicious/noConsole: intentional user-facing warning
      return console.warn('Calling `release` before `request` has no effect.');
    }

    await wakeLock.current?.release();
  }, [isSupported]);

  // Release any acquired wake lock when the component unmounts, otherwise the
  // sentinel keeps the screen awake forever after the consumer is gone. Release
  // the ref directly (not via `release`) so we don't emit the "release before
  // request" warning when no lock was ever acquired, and guard against an
  // already-released sentinel.
  useEffect(() => {
    return () => {
      const sentinel = wakeLock.current;
      if (sentinel != null && !sentinel.released) {
        void sentinel.release();
      }
      wakeLock.current = null;
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
