import { useFunction } from '@frozik/components';
import { isFunction, isNil } from 'lodash-es';
import type { ReactNode } from 'react';
import { memo, useEffect, useRef, useState } from 'react';

import { SvgRotateToLandscape } from '../../../icons/SvgRotateToLandscape';

interface ISavedState {
  readonly wasFullscreen: boolean;
  readonly previousOrientation: OrientationLockType;
}

export const LandscapePrompt = memo(({ children }: { children: ReactNode }) => {
  const [isPortrait, setIsPortrait] = useState(false);
  const savedStateRef = useRef<ISavedState | null>(null);

  useEffect(() => {
    if (isNil(screen.orientation) || !isFunction(screen.orientation.lock)) {
      return;
    }

    function checkOrientation(): void {
      setIsPortrait(screen.orientation.type.startsWith('portrait') && !document.fullscreenElement);
    }

    checkOrientation();
    screen.orientation.addEventListener('change', checkOrientation);
    document.addEventListener('fullscreenchange', checkOrientation);

    return () => {
      screen.orientation.removeEventListener('change', checkOrientation);
      document.removeEventListener('fullscreenchange', checkOrientation);

      // Restore previous state on unmount (leaving the page)
      const saved = savedStateRef.current;
      if (isNil(saved)) {
        return;
      }

      screen.orientation.unlock();

      if (!saved.wasFullscreen && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

      savedStateRef.current = null;
    };
  }, []);

  const handleEnterLandscape = useFunction(async () => {
    // Save current state before changing
    savedStateRef.current = {
      wasFullscreen: Boolean(document.fullscreenElement),
      previousOrientation: screen.orientation.type as OrientationLockType,
    };

    try {
      await document.documentElement.requestFullscreen();
      await screen.orientation?.lock?.('landscape');
    } catch {
      // Not supported
    }
  });

  return (
    <div className="relative h-full w-full">
      {children}
      {isPortrait && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <button
            type="button"
            onClick={handleEnterLandscape}
            className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-500/80 text-white shadow-lg backdrop-blur-sm transition-transform active:scale-95"
          >
            <SvgRotateToLandscape className="h-14 w-14" />
          </button>
        </div>
      )}
    </div>
  );
});
