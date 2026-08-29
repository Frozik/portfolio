import { useFunction } from '@frozik/components/hooks/useFunction';
import { isFunction } from 'lodash-es';
import { useEffect, useRef, useState } from 'react';

export interface IFullscreenLandscape {
  /** True when the browser can put the page fullscreen (orientation lock stays best-effort). */
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
 * Support is gated on the Fullscreen API alone: that is what the button
 * delivers everywhere, while landscape orientation lock is a best-effort
 * bonus on devices that can rotate (desktop browsers either omit
 * `screen.orientation.lock` entirely, like Safari, or throw
 * `NotSupportedError` from it, like Chrome). iOS Safari reports
 * `fullscreenEnabled = false` for page elements, so the trigger hides there.
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
    setIsSupported(
      document.fullscreenEnabled && isFunction(document.documentElement.requestFullscreen)
    );
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
