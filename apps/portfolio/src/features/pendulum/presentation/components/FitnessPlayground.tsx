import { useFunction } from '@frozik/components';
import {
  isFailValueDescriptor,
  isLoadingValueDescriptor,
  matchValueDescriptor,
} from '@frozik/utils';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { OverlayLoader } from '../../../../shared/components/OverlayLoader';
import { ValueDescriptorFail } from '../../../../shared/components/ValueDescriptorFail';
import { usePendulumStore } from '../../application/usePendulumStore';
import { useCompetition } from '../hooks/useCompetition';
import { useFrameTicker } from '../hooks/useFrameTicker';
import { usePlayground } from '../hooks/usePlayground';
import { useRenderer } from '../hooks/useRenderer';
import commonStyles from './common.module.scss';
import { FrameTickerDriver } from './FrameTickerDriver';
import { PendulumPlayground } from './PendulumPlayground';

export const FitnessPlayground = observer(() => {
  const store = usePendulumStore();

  const currentCompetition = store.currentCompetition;

  const paused = store.paused;
  const handlePausedChange = useFunction((next: boolean) => store.setPaused(next));

  const competition = useCompetition();

  const gravity = store.playgroundGravity;
  const handleGravityChange = useFunction((g: number) => store.setPlaygroundGravity(g));

  const [renderer, setContexts] = useRenderer();
  const ticker = useFrameTicker(
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

  return (
    <>
      <FrameTickerDriver ticker={ticker} paused={paused} />
      {matchValueDescriptor(currentCompetition, {
        synced: () => (
          <PendulumPlayground
            paused={paused}
            gravity={gravity}
            pauseResumeKeyCode="Space"
            onGravityChanged={handleGravityChange}
            onPausedChanged={handlePausedChange}
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
          if (isFailValueDescriptor(vd)) {
            return (
              <div className={commonStyles.alertContainer}>
                <ValueDescriptorFail fail={vd.fail} />
              </div>
            );
          }
          return null;
        },
      })}
    </>
  );
});
