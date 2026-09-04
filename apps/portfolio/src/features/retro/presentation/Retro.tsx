import { observer } from 'mobx-react-lite';
import { Outlet } from 'react-router-dom';

import { SignInGate } from '../../../shared/communication/SignInGate';
import { useSignalingHealth } from '../../../shared/communication/useSignalingHealth';
import { useFirstUserGesture } from '../../../shared/hooks/useFirstUserGesture';
import { Spinner } from '../../../shared/ui/Spinner';
import { useRetroLobbyStore } from '../application/useRetroLobbyStore';
import { RetroBackground } from './components/RetroBackground';
import { SignalingUnavailable } from './components/SignalingUnavailable';

export const Retro = observer(() => {
  const healthStatus = useSignalingHealth();
  const lobbyStore = useRetroLobbyStore();
  useFirstUserGesture(lobbyStore.primeAudio);

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
