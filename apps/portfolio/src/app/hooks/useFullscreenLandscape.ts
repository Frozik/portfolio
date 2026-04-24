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
  readonly previousOrientation: OrientationLockType;
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
    if (isActive) {
      const saved = savedStateRef.current;
      savedStateRef.current = null;
      setIsActive(false);
      try {
        screen.orientation?.unlock?.();
        if (saved !== null && !saved.wasFullscreen && document.fullscreenElement !== null) {
          await document.exitFullscreen();
        }
      } catch {
        // Browser refused — state is already reset.
      }
      return;
    }

    savedStateRef.current = {
      wasFullscreen: document.fullscreenElement !== null,
      previousOrientation: screen.orientation.type as OrientationLockType,
    };

    try {
      if (document.fullscreenElement === null) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      savedStateRef.current = null;
      return;
    }

    // Orientation lock is best-effort: desktop browsers expose the API
    // but throw `NotSupportedError` on lock(). We still want the button
    // to show "active" because fullscreen itself succeeded.
    try {
      await screen.orientation?.lock?.('landscape');
    } catch {
      // Desktop / unsupported — ignore.
    }

    setIsActive(true);
  });

  return { isSupported, isActive, toggle };
}
