import { memo } from 'react';

import { WebGpuGuard } from '../../../shared/components/WebGpuGuard';
import { ScorchedGame } from './components/ScorchedGame';

export const Scorched = memo(() => {
  return (
    <WebGpuGuard className="h-full w-full">
      <ScorchedGame />
    </WebGpuGuard>
  );
});
