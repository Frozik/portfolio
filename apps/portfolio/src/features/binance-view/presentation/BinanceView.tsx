import { memo } from 'react';

import { WebGpuGuard } from '../../../shared/components/WebGpuGuard';

import { BinanceViewContent } from './BinanceViewContent';

export const BinanceView = memo(() => {
  return (
    <WebGpuGuard className="h-full w-full">
      <BinanceViewContent />
    </WebGpuGuard>
  );
});
