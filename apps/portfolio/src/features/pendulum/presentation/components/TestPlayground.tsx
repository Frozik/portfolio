import { useFunction } from '@frozik/components/hooks/useFunction';
import {
  createSyncedValueDescriptor,
  isFailValueDescriptor,
  isLoadingValueDescriptor,
  isSyncedValueDescriptor,
  matchValueDescriptor,
} from '@frozik/utils/value-descriptors/utils';
import { isNil } from 'lodash-es';
import { Bot, User, X } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { OverlayLoader } from '../../../../shared/components/OverlayLoader';
import { ValueDescriptorFail } from '../../../../shared/components/ValueDescriptorFail';
import { usePendulumStore } from '../../application/usePendulumStore';
import { HumanPlayer } from '../../domain/players/HumanPlayer';
import type { TPlayer } from '../../domain/types';
import { EPlayerType } from '../../domain/types';
import { useFrameTicker } from '../hooks/useFrameTicker';
import { usePlayground } from '../hooks/usePlayground';
import { useRenderer } from '../hooks/useRenderer';
import { WindowKeyStateSource } from '../input/WindowKeyStateSource';
import commonStyles from './common.module.scss';
import { FrameTickerDriver } from './FrameTickerDriver';
import { PendulumPlayground } from './PendulumPlayground';

const ICON_SIZE = 16;

export const TestPlayground = observer(() => {
  const store = usePendulumStore();

  const robotVD = store.currentRobot;

  // The fallback HumanPlayer is built in an effect (not render) so its window
  // listeners are cleaned up on unmount and not leaked by StrictMode double-mount.
  const [humanPlayer, setHumanPlayer] = useState<HumanPlayer>();
  const needsHumanPlayer =
    !isLoadingValueDescriptor(robotVD) &&
    !isFailValueDescriptor(robotVD) &&
    !isSyncedValueDescriptor(robotVD);

  useEffect(() => {
    if (!needsHumanPlayer) {
      setHumanPlayer(undefined);
      return;
    }

    const player = new HumanPlayer(new WindowKeyStateSource());
    setHumanPlayer(player);

    return () => {
      player.dispose();
      setHumanPlayer(undefined);
    };
  }, [needsHumanPlayer]);

  const playerVD = matchValueDescriptor(robotVD, {
    synced: ({ value: robot }) =>
      createSyncedValueDescriptor<{ player: TPlayer; owned: boolean }>({
        player: robot,
        owned: false,
      }),
    unsynced: vd =>
      isLoadingValueDescriptor(vd) || isFailValueDescriptor(vd)
        ? vd
        : isNil(humanPlayer)
          ? vd
          : createSyncedValueDescriptor<{ player: TPlayer; owned: boolean }>({
              player: humanPlayer,
              owned: true,
            }),
  });

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

  const player = isSyncedValueDescriptor(playerVD) ? playerVD.value : undefined;

  useEffect(
    () =>
      void playground?.clear().then(() => {
        if (!isNil(player)) {
          playground.addPlayer(player.player, { owned: player.owned });
        }
      }),
    [playground, player]
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
        {!isNil(player) && (
          <>
            {player.player.type === EPlayerType.Human && (
              <div className={commonStyles.description}>
                <User size={ICON_SIZE} />

                {player.player.name}
              </div>
            )}
            {player.player.type === EPlayerType.Robot && (
              <div className={commonStyles.descriptionWithRemoval} onClick={handleRemovePlayer}>
                <Bot size={ICON_SIZE} />

                {player.player.name}

                <X size={ICON_SIZE} className={commonStyles.descriptionClose} />
              </div>
            )}
          </>
        )}
      </PendulumPlayground>
    </>
  );
});
