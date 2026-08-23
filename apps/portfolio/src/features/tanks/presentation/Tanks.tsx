import { memo } from 'react';

import { WebGpuGuard } from '../../../shared/components/WebGpuGuard';
import { TanksGame } from './components/TanksGame';

export const Tanks = memo(() => {
  return (
    <WebGpuGuard className="h-full w-full">
      <TanksGame />
    </WebGpuGuard>
  );
});
