import { useFunction } from '@frozik/components/hooks/useFunction';
import { isFunction, isNil } from 'lodash-es';
import { useEffect, useState } from 'react';

export interface IFullscreenLandscape {
  /** True only when the browser exposes both fullscreen and orientation-lock APIs (mobile / tablet). */
  readonly isSupported: boolean;
  /** Request fullscreen on `<html>` and lock orientation to landscape. */
  readonly enter: () => Promise<void>;
}

/**
 * Capability-aware "go fullscreen + landscape" action.
 *
 * Desktops and most iOS Safari builds will report `isSupported = false`
 * because `screen.orientation.lock` is missing — the consumer should hide
 * the trigger UI in that case.
 */
export function useFullscreenLandscape(): IFullscreenLandscape {
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const orientation = (screen as Screen & { orientation?: ScreenOrientation }).orientation;
    setIsSupported(!isNil(orientation) && isFunction(orientation.lock));
  }, []);

  const enter = useFunction(async () => {
    try {
      await document.documentElement.requestFullscreen();
      await screen.orientation?.lock?.('landscape');
    } catch {
      // Browser refused (e.g. user gesture lost, permission denied) — silently noop.
    }
  });

  return { isSupported, enter };
}
