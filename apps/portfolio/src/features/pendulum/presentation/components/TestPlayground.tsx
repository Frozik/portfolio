import { useFunction } from '@frozik/components/hooks/useFunction';
import {
  isFailValueDescriptor,
  isLoadingValueDescriptor,
  matchValueDescriptor,
} from '@frozik/utils/value-descriptors/utils';
import { Bot, User, X } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import { OverlayLoader } from '../../../../shared/components/OverlayLoader';
import { ValueDescriptorFail } from '../../../../shared/components/ValueDescriptorFail';
import { usePendulumStore } from '../../application/usePendulumStore';
import { HUMAN_PLAYER_NAME } from '../../domain/players/HumanPlayer';
import { OVERLAY_MESSAGE_CONTAINER_CLASS, PLAYER_LABEL_CLASS } from '../constants';
import { PendulumPlayground } from './PendulumPlayground';

const ICON_SIZE = 16;

export const TestPlayground = observer(() => {
  const store = usePendulumStore();
  const robot = store.selectedRobot;

  const handleRemoveRobot = useFunction(() => store.selectRobot(undefined));

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
    <PendulumPlayground session={store.test} pauseResumeKeyCode="Space" pointerForce>
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
