import { useFunction } from '@frozik/components';
import {
  isFailValueDescriptor,
  isLoadingValueDescriptor,
  matchValueDescriptor,
} from '@frozik/utils';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { OverlayLoader } from '../../../../shared/components/OverlayLoader';
import { ValueDescriptorFail } from '../../../../shared/components/ValueDescriptorFail';
import { Alert } from '../../../../shared/ui';
import { usePendulumStore } from '../../application/usePendulumStore';
import { useCompetition } from '../hooks/useCompetition';
import { useFrameTicker } from '../hooks/useFrameTicker';
import { usePlayground } from '../hooks/usePlayground';
import { useRenderer } from '../hooks/useRenderer';
import commonStyles from './common.module.scss';
import { PendulumPlayground } from './PendulumPlayground';

export const FitnessPlayground = observer(() => {
  const store = usePendulumStore();

  const currentCompetition = store.currentCompetition;

  const [paused, setPaused] = useState(true);

  const competition = useCompetition();

  const gravity = store.playgroundGravity;
  const handleGravityChange = useFunction((g: number) => store.setPlaygroundGravity(g));

  const [renderer, setContexts] = useRenderer();
  const ticker = useFrameTicker(
    paused,
    useFunction((_, multiplier) =>
      new Array(multiplier).fill(0).map(() => 8 + Math.round(Math.random() * 2400) / 100)
    )
  );
  const playground = usePlayground(ticker, renderer, { gravity });

  useEffect(
    () =>
      void playground
        ?.clear()
        .then(() => (isNil(competition) ? undefined : playground.addCompetition(competition))),
    [playground, competition]
  );

  return matchValueDescriptor(currentCompetition, {
    synced: () => (
      <PendulumPlayground
        paused={paused}
        gravity={gravity}
        pauseResumeKeyCode="Space"
        onGravityChanged={handleGravityChange}
        onPausedChanged={setPaused}
        onSetContexts={setContexts}
      />
    ),
    unsynced: vd => {
      if (isLoadingValueDescriptor(vd)) {
        return (
          <div className={commonStyles.alertContainer}>
            <OverlayLoader />
          </div>
        );
      }
      return (
        <div className={commonStyles.alertContainer}>
          {isFailValueDescriptor(vd) ? (
            <ValueDescriptorFail fail={vd.fail} />
          ) : (
            <Alert
              message="Competition not started"
              description={
                <div className={commonStyles.leftAligned}>
                  <p>
                    This demo uses a genetic algorithm to evolve neural network weights that balance
                    an inverted pendulum around the zero mark.
                  </p>
                  <ul>
                    <li>
                      Open the <strong>Generations</strong> tab and click{' '}
                      <strong>Create New</strong> to start a new search, or select a previously
                      saved training run to continue.
                    </li>
                    <li>
                      The fitness function starts paused — press the play button to begin evolution.
                    </li>
                    <li>
                      The generations table ranks neural networks by fitness score. Select any
                      network to inspect it in the <strong>Test Playground</strong> or{' '}
                      <strong>Neural Network</strong> tabs.
                    </li>
                    <li>
                      In the test tab you can apply external force by clicking, holding, and
                      dragging toward the pendulum weight.
                    </li>
                  </ul>
                  <p>
                    Simulation speed adapts automatically to available CPU performance while keeping
                    the UI responsive.
                  </p>
                </div>
              }
              type="info"
            />
          )}
        </div>
      );
    },
  });
});
