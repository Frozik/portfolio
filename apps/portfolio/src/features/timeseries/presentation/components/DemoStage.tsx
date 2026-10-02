import { canvas2d } from '@frozik/charts/canvas2d/backend';
import { ChartStageProvider, useChartStage } from '@frozik/charts/react/ChartStageProvider';
import { availableBackends } from '@frozik/charts/universal/backends';
import { toFail } from '@frozik/utils/value-descriptors/fails/utils';
import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';
import { memo } from 'react';

import { ValueDescriptorFail } from '../../../../shared/components/ValueDescriptorFail';
import { useTimeseriesDemoStore } from '../../application/useTimeseriesDemoStore';
import { DebugOverlay } from './DebugOverlay';

/** WebGPU under a 2D canvas overlay where the device has a GPU to give, the 2D canvas alone where it has not. */
function bestBackends() {
  return availableBackends();
}

function canvasBackends() {
  return [canvas2d()];
}

const StageGate = memo(({ children }: { readonly children: ReactNode }) => {
  const state = useChartStage();
  if (state.status === 'failed') {
    return <ValueDescriptorFail fail={toFail(state.error)} />;
  }
  return (
    <>
      <DebugOverlay />
      {children}
    </>
  );
});

/**
 * One stage for every chart of a page: one frame loop, and on WebGPU one
 * device and one submission a frame. The debug panel can take the GPU away,
 * and the same charts are then drawn by the 2D canvas.
 */
export const DemoStage = observer(({ children }: { readonly children: ReactNode }) => {
  const store = useTimeseriesDemoStore();
  return (
    <ChartStageProvider backends={store.canvasOnly ? canvasBackends : bestBackends}>
      <StageGate>{children}</StageGate>
    </ChartStageProvider>
  );
});
