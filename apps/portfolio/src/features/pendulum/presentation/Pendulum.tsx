import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';

import { DialogShell } from '../../../shared/ui/DialogShell';
import { usePendulumStore } from '../application/usePendulumStore';
import { DrawNeuralNetwork } from './components/DrawNeuralNetwork';
import { FitnessPlayground } from './components/FitnessPlayground';
import { GenerationsList } from './components/GenerationsList';
import { PendulumSection } from './components/PendulumSection';
import { TestPlayground } from './components/TestPlayground';
import { usePreventScreensaver } from './hooks/usePreventScreensaver';
import { pendulumT } from './translations';

export const Pendulum = observer(() => {
  usePreventScreensaver();

  const store = usePendulumStore();

  // init is idempotent — safe to call on every mount (including StrictMode double-mount).
  // dispose is NOT tied to useEffect cleanup because StrictMode would destroy
  // the singleton store's subscriptions and re-init would create conflicting IndexedDB connections.
  useEffect(() => {
    store.init();
  }, [store]);

  return (
    <div className="relative flex h-full w-full flex-col bg-landing-bg">
      <PendulumSection number="01" title={pendulumT.tabs.fitnessPlayground} heightClass="h-[34%]">
        <FitnessPlayground />
      </PendulumSection>
      <PendulumSection number="02" title={pendulumT.tabs.generations} heightClass="h-[33%]">
        <GenerationsList />
      </PendulumSection>
      <PendulumSection number="03" title={pendulumT.tabs.testPlayground} heightClass="h-[33%]">
        <TestPlayground />
      </PendulumSection>
      <DialogShell
        open={store.isNeuralNetworkDialogOpen}
        onClose={store.closeNeuralNetworkDialog}
        kicker="NEURAL NETWORK"
        title={pendulumT.tabs.neuralNetwork}
        className="w-[min(95vw,1100px)] p-6"
      >
        <div className="relative h-[70vh] w-full">
          <DrawNeuralNetwork />
        </div>
      </DialogShell>
    </div>
  );
});
