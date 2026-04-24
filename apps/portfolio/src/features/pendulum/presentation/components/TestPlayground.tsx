import { useFunction } from '@frozik/components';
import {
  createSyncedValueDescriptor,
  isFailValueDescriptor,
  isLoadingValueDescriptor,
  isSyncedValueDescriptor,
  matchValueDescriptor,
} from '@frozik/utils';
import { isNil } from 'lodash-es';
import { Bot, User, X } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useState } from 'react';
import { OverlayLoader } from '../../../../shared/components/OverlayLoader';
import { ValueDescriptorFail } from '../../../../shared/components/ValueDescriptorFail';
import { usePendulumStore } from '../../application/usePendulumStore';
import { HumanPlayer } from '../../domain/players/HumanPlayer';
import { EPlayerType } from '../../domain/types';
import { useFrameTicker } from '../hooks/useFrameTicker';
import { usePlayground } from '../hooks/usePlayground';
import { useRenderer } from '../hooks/useRenderer';
import commonStyles from './common.module.scss';
import { FrameTickerDriver } from './FrameTickerDriver';
import { PendulumPlayground } from './PendulumPlayground';

const ICON_SIZE = 16;

export const TestPlayground = observer(() => {
  const store = usePendulumStore();

  const robotVD = store.currentRobot;

  const playerVD = useMemo(
    () =>
      matchValueDescriptor(robotVD, {
        synced: ({ value: robot }) => createSyncedValueDescriptor(robot),
        unsynced: vd =>
          isLoadingValueDescriptor(vd) || isFailValueDescriptor(vd)
            ? vd
            : createSyncedValueDescriptor(new HumanPlayer()),
      }),
    [robotVD]
  );

  const [paused, setPaused] = useState(true);

  const gravity = store.gravity;
  const handleGravityChange = useFunction((g: number) => store.setGravity(g));
  const [additionalForcePosition, setAdditionalForcePosition] = useState<{
    x: number;
    y: number;
  }>();

  const [renderer, setContextsWorld] = useRenderer();
  const ticker = useFrameTicker();
  const playground = usePlayground(ticker, renderer, { gravity });

  useEffect(
    () =>
      void playground?.clear().then(() => {
        if (isSyncedValueDescriptor(playerVD)) {
          playground.addPlayer(playerVD.value);
        }
      }),
    [playground, playerVD]
  );

  useEffect(() => {
    if (isNil(playground)) {
      return;
    }

    playground.setAdditionalForcePosition(additionalForcePosition);
  }, [playground, additionalForcePosition]);

  const handleRemovePlayer = useFunction(() => store.setSelectedRobotId(undefined));

  if (isLoadingValueDescriptor(playerVD)) {
    return (
      <div className={commonStyles.alertContainer}>
        <OverlayLoader />
      </div>
    );
  }
  if (isFailValueDescriptor(playerVD)) {
    return <ValueDescriptorFail fail={playerVD.fail} />;
  }

  return (
    <>
      <FrameTickerDriver ticker={ticker} paused={paused} />
      <PendulumPlayground
        paused={paused}
        gravity={gravity}
        pauseResumeKeyCode="Space"
        onAdditionalForce={setAdditionalForcePosition}
        onGravityChanged={handleGravityChange}
        onPausedChanged={setPaused}
        onSetContexts={setContextsWorld}
      >
        {isSyncedValueDescriptor(playerVD) && (
          <>
            {playerVD.value.type === EPlayerType.Human && (
              <div className={commonStyles.description}>
                <User size={ICON_SIZE} />

                {playerVD.value.name}
              </div>
            )}
            {playerVD.value.type === EPlayerType.Robot && (
              <div className={commonStyles.descriptionWithRemoval} onClick={handleRemovePlayer}>
                <Bot size={ICON_SIZE} />

                {playerVD.value.name}

                <X size={ICON_SIZE} className={commonStyles.descriptionClose} />
              </div>
            )}
          </>
        )}
      </PendulumPlayground>
    </>
  );
});
