import {
  isFailValueDescriptor,
  isLoadingValueDescriptor,
  matchValueDescriptor,
} from '@frozik/utils/value-descriptors/utils';
import { observer } from 'mobx-react-lite';

import { OverlayLoader } from '../../../../shared/components/OverlayLoader';
import { ValueDescriptorFail } from '../../../../shared/components/ValueDescriptorFail';
import { usePendulumStore } from '../../application/usePendulumStore';
import { OVERLAY_MESSAGE_CONTAINER_CLASS } from '../constants';
import { PendulumPlayground } from './PendulumPlayground';

export const FitnessPlayground = observer(() => {
  const store = usePendulumStore();

  return matchValueDescriptor(store.generations, {
    synced: () => <PendulumPlayground session={store.fitness} pauseResumeKeyCode="Space" />,
    unsynced: generations => {
      if (isLoadingValueDescriptor(generations)) {
        return (
          <div className={OVERLAY_MESSAGE_CONTAINER_CLASS}>
            <OverlayLoader />
          </div>
        );
      }
      if (isFailValueDescriptor(generations)) {
        return (
          <div className={OVERLAY_MESSAGE_CONTAINER_CLASS}>
            <ValueDescriptorFail fail={generations.fail} />
          </div>
        );
      }
      return null;
    },
  });
});
