import { observer } from 'mobx-react-lite';

import type { TGroup } from '../../contexts/grouping/domain/group';
import { Sheet } from '../kit/Sheet';
import { PolicySwitches } from './PolicySwitches';
import { SettingIcons } from './SettingIcons';

/** What a group does and when, changed from the status icon on its name's line. */
export const PolicySheet = observer(function PolicySheet({
  group,
  onClose,
}: {
  readonly group: TGroup;
  readonly onClose: () => void;
}) {
  return (
    <Sheet visible onClose={onClose} testID="policy-sheet">
      <PolicySwitches group={group} />
      <SettingIcons group={group} onLeave={onClose} />
    </Sheet>
  );
});
