import { observer } from 'mobx-react-lite';

import type { TGroup } from '../../contexts/grouping/domain/group';
import { Sheet } from '../kit/Sheet';
import { PolicySwitches } from './PolicySwitches';
import { SettingIcons } from './SettingIcons';

/** What a group does, changed from the status icon on its name's line: for good, or for a while. */
export const PolicySheet = observer(function PolicySheet({
  group,
  onClose,
  onForAWhile,
}: {
  readonly group: TGroup;
  readonly onClose: () => void;
  readonly onForAWhile: () => void;
}) {
  return (
    <Sheet visible onClose={onClose} testID="policy-sheet">
      <PolicySwitches group={group} />
      <SettingIcons group={group} onLeave={onClose} onForAWhile={onForAWhile} />
    </Sheet>
  );
});
