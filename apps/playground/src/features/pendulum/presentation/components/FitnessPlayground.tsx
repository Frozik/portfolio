import { useFunction } from '@frozik/components';
import { isFailValueDescriptor, matchValueDescriptor } from '@frozik/utils';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
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
    unsynced: vd => (
      <div className={commonStyles.alertContainer}>
        {isFailValueDescriptor(vd) ? (
          <ValueDescriptorFail fail={vd.fail} />
        ) : (
          <Alert
            message="Competition not started"
            description={
              <div className={commonStyles.leftAligned}>
                <p>
                  The goal of the application is to find the structure of the neural network and its
                  weights using a genetic algorithm to balance the pendulum around the zero mark.
                </p>
                <ul>
                  <li>
                    Create a new competition or continue a saved one by making a selection from the
                    list provided below.
                  </li>
                  <li>
                    After loading, the fitness function will be on pause; you need to start the
                    execution.
                  </li>
                  <li>
                    The generations table will display neural networks sorted by ranking along with
                    their scored points.
                  </li>
                  <li>
                    You can select a neural network and see how it performs in the testing tab (you
                    can add influence by clicking and holding the mouse and dragging it to the
                    weight of the pendulum).
                  </li>
                </ul>
                <p>
                  The simulation speed will depend on the available performance, automatically
                  adjusting to the maximum possible while ensuring a responsive UI.
                </p>
              </div>
            }
            type="info"
          />
        )}
      </div>
    ),
  });
});
