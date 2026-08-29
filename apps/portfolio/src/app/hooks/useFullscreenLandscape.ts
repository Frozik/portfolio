import { useFunction } from '@frozik/components/hooks/useFunction';
import { isFunction, isNil } from 'lodash-es';
import { useEffect, useRef, useState } from 'react';

export interface IFullscreenLandscape {
  /** True only when the browser exposes both fullscreen and orientation-lock APIs (mobile / tablet). */
  readonly isSupported: boolean;
  /** True while the user's "enter" request is still active — restored by `toggle()`. */
  readonly isActive: boolean;
  /** Toggle fullscreen + landscape. On exit, restore the pre-entry fullscreen / orientation state. */
  readonly toggle: () => Promise<void>;
}

interface ISavedState {
  readonly wasFullscreen: boolean;
}

/**
 * Capability-aware "go fullscreen + landscape" toggle.
 *
 * Desktops and most iOS Safari builds will report `isSupported = false`
 * because `screen.orientation.lock` is missing — the consumer should hide
 * the trigger UI in that case.
 *
 * Second tap exits fullscreen and unlocks orientation, but only undoes
 * what this toggle actually changed: if the user was already fullscreen
 * before entering, exiting keeps the page fullscreen.
 */
export function useFullscreenLandscape(): IFullscreenLandscape {
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const savedStateRef = useRef<ISavedState | null>(null);

  useEffect(() => {
    const orientation = (screen as Screen & { orientation?: ScreenOrientation }).orientation;
    setIsSupported(!isNil(orientation) && isFunction(orientation.lock));
  }, []);

  useEffect(() => {
    const handleFullscreenChange = (): void => {
      // biome-ignore lint/suspicious/noConsole: temporary >>> debug trace
      console.log('>>> fullscreenchange', {
        fullscreenElement: document.fullscreenElement?.tagName ?? null,
        hasSavedState: savedStateRef.current !== null,
      });
      if (document.fullscreenElement === null && savedStateRef.current !== null) {
        savedStateRef.current = null;
        screen.orientation?.unlock?.();
        setIsActive(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggle = useFunction(async () => {
    // biome-ignore lint/suspicious/noConsole: temporary >>> debug trace
    console.log('>>> fullscreen toggle', {
      isActive,
      fullscreenElement: document.fullscreenElement?.tagName ?? null,
    });
    if (isActive) {
      const saved = savedStateRef.current;
      savedStateRef.current = null;
      setIsActive(false);
      try {
        screen.orientation?.unlock?.();
        if (saved !== null && !saved.wasFullscreen && document.fullscreenElement !== null) {
          await document.exitFullscreen();
        }
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: temporary >>> debug trace
        console.log('>>> fullscreen exit failed', error);
      }
      return;
    }

    savedStateRef.current = {
      wasFullscreen: document.fullscreenElement !== null,
    };

    try {
      if (document.fullscreenElement === null) {
        await document.documentElement.requestFullscreen();
      }
      // biome-ignore lint/suspicious/noConsole: temporary >>> debug trace
      console.log('>>> requestFullscreen resolved', {
        fullscreenElement: document.fullscreenElement?.tagName ?? null,
      });
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: temporary >>> debug trace
      console.log('>>> requestFullscreen failed', error);
      savedStateRef.current = null;
      return;
    }

    // Orientation lock is best-effort: desktop browsers expose the API
    // but throw `NotSupportedError` on lock(). We still want the button
    // to show "active" because fullscreen itself succeeded.
    try {
      await screen.orientation?.lock?.('landscape');
      // biome-ignore lint/suspicious/noConsole: temporary >>> debug trace
      console.log('>>> orientation lock resolved');
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: temporary >>> debug trace
      console.log('>>> orientation lock rejected (expected on desktop)', error);
    }

    setIsActive(true);
  });

  return { isSupported, isActive, toggle };
}
