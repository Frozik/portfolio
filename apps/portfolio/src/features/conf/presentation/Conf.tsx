import { observer } from 'mobx-react-lite';
import { Outlet } from 'react-router-dom';

import { useSignalingHealth } from '../../../shared/communication/useSignalingHealth';
import { Spinner } from '../../../shared/ui/Spinner';
import { ConfSignalingUnavailable } from './components/ConfSignalingUnavailable';

export const Conf = observer(() => {
  const healthStatus = useSignalingHealth();

  return (
    <div className="h-full w-full flex flex-col text-text">
      {healthStatus === 'checking' && (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <Spinner />
        </div>
      )}
      {healthStatus === 'unavailable' && <ConfSignalingUnavailable />}
      {healthStatus === 'ok' && <Outlet />}
    </div>
  );
});
