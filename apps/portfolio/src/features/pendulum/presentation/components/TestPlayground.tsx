import {
  isFailValueDescriptor,
  isLoadingValueDescriptor,
  isSyncedValueDescriptor,
  matchValueDescriptor,
} from '@frozik/utils/value-descriptors/utils';
import { isNil } from 'lodash-es';
import { Bot, User, X } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useEventCallback } from 'usehooks-ts';

import { OverlayLoader } from '../../../../shared/components/OverlayLoader';
import { ValueDescriptorFail } from '../../../../shared/components/ValueDescriptorFail';
import { usePendulumStore } from '../../application/usePendulumStore';
import { HUMAN_PLAYER_NAME } from '../../domain/players/HumanPlayer';
import type { IPoint } from '../../domain/types';
import {
  OVERLAY_MESSAGE_CONTAINER_CLASS,
  PLAYER_LABEL_CLASS,
  PLAYER_LABEL_SCENE_OFFSET_CLASS,
} from '../constants';
import { PendulumPlayground } from './PendulumPlayground';

const ICON_SIZE = 16;

export const TestPlayground = observer(() => {
  const store = usePendulumStore();
  const robot = store.selectedRobot;

  const handleRemoveRobot = useEventCallback(() => store.selectRobot(undefined));

  const handleScenePress = useEventCallback((point: IPoint | undefined) => {
    if (!isNil(point)) {
      store.test.setPaused(false);
    }

    if (isSyncedValueDescriptor(robot)) {
      store.test.setPointerPosition(point);
    } else {
      store.dragTestCart(point?.x);
    }
  });

  if (isLoadingValueDescriptor(robot)) {
    return (
      <div className={OVERLAY_MESSAGE_CONTAINER_CLASS}>
        <OverlayLoader />
      </div>
    );
  }
  if (isFailValueDescriptor(robot)) {
    return <ValueDescriptorFail fail={robot.fail} />;
  }

  return (
    <PendulumPlayground
      session={store.test}
      pauseResumeKeyCode="Space"
      onScenePress={handleScenePress}
      sceneClassName={PLAYER_LABEL_SCENE_OFFSET_CLASS}
    >
      {matchValueDescriptor(robot, {
        synced: ({ value }) => (
          <div className={PLAYER_LABEL_CLASS} onClick={handleRemoveRobot}>
            <Bot size={ICON_SIZE} />
            {value.name}
            <X size={ICON_SIZE} />
          </div>
        ),
        unsynced: () => (
          <div className={PLAYER_LABEL_CLASS}>
            <User size={ICON_SIZE} />
            {HUMAN_PLAYER_NAME}
          </div>
        ),
      })}
    </PendulumPlayground>
  );
});
