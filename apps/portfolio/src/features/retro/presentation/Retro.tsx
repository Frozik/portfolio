import { observer } from 'mobx-react-lite';
import { Outlet } from 'react-router-dom';

import { cn } from '../../../shared/lib/cn';
import commonStyles from '../../../shared/styles.module.scss';

export const Retro = observer(() => {
  return (
    <div className={cn('flex flex-col text-text', commonStyles.fixedContainer)}>
      <Outlet />
    </div>
  );
});
