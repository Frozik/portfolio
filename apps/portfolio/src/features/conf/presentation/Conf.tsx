import { observer } from 'mobx-react-lite';
import { Outlet } from 'react-router-dom';

import { cn } from '../../../shared/lib/cn';
import commonStyles from '../../../shared/styles.module.scss';
import { Spinner } from '../../../shared/ui';
import { ConfSignalingUnavailable } from './components/ConfSignalingUnavailable';
import { useConfSignalingHealth } from './hooks/useConfSignalingHealth';

export const Conf = observer(() => {
  const healthStatus = useConfSignalingHealth();

  return (
    <div className={cn('flex flex-col text-text', commonStyles.fixedContainer)}>
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
