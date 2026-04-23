import { observer } from 'mobx-react-lite';
import { Outlet } from 'react-router-dom';

import { Spinner } from '../../../shared/ui';
import { SignalingUnavailable } from './components/SignalingUnavailable';
import { useSignalingHealth } from './hooks/useSignalingHealth';

export const Retro = observer(() => {
  const healthStatus = useSignalingHealth();

  return (
    <div className="h-full w-full flex flex-col text-text">
      {healthStatus === 'checking' && (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <Spinner />
        </div>
      )}
      {healthStatus === 'unavailable' && <SignalingUnavailable />}
      {healthStatus === 'ok' && <Outlet />}
    </div>
  );
});
