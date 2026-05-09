import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

import { SignInGate } from '../../../shared/communication/SignInGate';
import { Spinner } from '../../../shared/ui/Spinner';
import { primeRetroAudio } from '../infrastructure/sound';
import { RetroBackground } from './components/RetroBackground';
import { SignalingUnavailable } from './components/SignalingUnavailable';
import { useSignalingHealth } from './hooks/useSignalingHealth';

const AUDIO_PRIME_EVENTS: ReadonlyArray<keyof DocumentEventMap> = [
  'pointerdown',
  'click',
  'keydown',
  'touchstart',
];

/**
 * Construct + resume the shared retro `AudioContext` on the very first
 * user gesture anywhere inside the feature root. Firefox refuses to
 * resume an `AudioContext` that was created outside a gesture, so we
 * have to catch the user as early as possible — before they navigate
 * into a room where the timer might already be running.
 *
 * Listeners are added in the capture phase so a `stopPropagation` deep
 * in the tree can't shadow us, and they de-arm themselves through a
 * shared `primed` flag the first time any of the four event types
 * fires.
 */
function useRetroAudioPrimer(): void {
  useEffect(() => {
    let primed = false;
    const handler = (): void => {
      if (primed) {
        return;
      }
      primed = true;
      primeRetroAudio();
    };
    for (const event of AUDIO_PRIME_EVENTS) {
      document.addEventListener(event, handler, { capture: true });
    }
    return () => {
      for (const event of AUDIO_PRIME_EVENTS) {
        document.removeEventListener(event, handler, { capture: true });
      }
    };
  }, []);
}

export const Retro = observer(() => {
  const healthStatus = useSignalingHealth();
  useRetroAudioPrimer();

  return (
    <>
      <RetroBackground />
      <div className="relative z-[2] flex h-full w-full flex-col text-text">
        {healthStatus === 'checking' && (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <Spinner />
          </div>
        )}
        {healthStatus === 'unavailable' && <SignalingUnavailable />}
        {healthStatus === 'ok' && (
          <SignInGate>
            <Outlet />
          </SignInGate>
        )}
      </div>
    </>
  );
});
