import { cn } from '@frozik/components/components/cn';
import { observer } from 'mobx-react-lite';

import { DialogShell } from '../../../shared/ui/DialogShell';
import { usePendulumStore } from '../application/usePendulumStore';
import { DrawNeuralNetwork } from './components/DrawNeuralNetwork';
import { FitnessPlayground } from './components/FitnessPlayground';
import { GenerationsList } from './components/GenerationsList';
import { PendulumSection } from './components/PendulumSection';
import { TestPlayground } from './components/TestPlayground';
import { PLAYER_LABEL_SECTION_PADDING_CLASS } from './constants';
import { usePreventScreensaver } from './hooks/usePreventScreensaver';
import { pendulumT } from './translations';

// The aspect ratio is the scene's own (render/scene-viewport.ts), so a narrow
// screen gives a playground exactly the height its shrunk scene needs.
const SCENE_SECTION_CLASS =
  'aspect-[964/250] max-h-[34%] shrink-0 short-landscape:col-start-1 short-landscape:aspect-auto short-landscape:max-h-none';

export const Pendulum = observer(() => {
  usePreventScreensaver();

  const store = usePendulumStore();

  return (
    <div className="relative h-full w-full bg-landing-bg [container-type:size]">
      <div className="flex h-full w-full flex-col short-landscape:grid short-landscape:grid-cols-[3fr_2fr] short-landscape:grid-rows-2">
        <PendulumSection
          number="01"
          title={pendulumT.tabs.fitnessPlayground}
          className={cn(SCENE_SECTION_CLASS, 'short-landscape:row-start-1')}
        >
          <FitnessPlayground />
        </PendulumSection>
        <PendulumSection
          number="02"
          title={pendulumT.tabs.generations}
          className="min-h-0 flex-1 short-landscape:col-start-2 short-landscape:row-span-2 short-landscape:row-start-1 short-landscape:border-b-0 short-landscape:border-l"
        >
          <GenerationsList />
        </PendulumSection>
        <PendulumSection
          number="03"
          title={pendulumT.tabs.testPlayground}
          className={cn(
            SCENE_SECTION_CLASS,
            PLAYER_LABEL_SECTION_PADDING_CLASS,
            'short-landscape:row-start-2'
          )}
        >
          <TestPlayground />
        </PendulumSection>
      </div>
      <DialogShell
        open={store.isNeuralNetworkDialogOpen}
        onClose={store.closeNeuralNetworkDialog}
        kicker="NEURAL NETWORK"
        title={pendulumT.tabs.neuralNetwork}
        className="w-[min(95vw,1100px)] p-6"
      >
        <div className="relative h-[70dvh] w-full">
          <DrawNeuralNetwork />
        </div>
      </DialogShell>
    </div>
  );
});
