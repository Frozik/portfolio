import { observer } from 'mobx-react-lite';

import type { TGroup } from '../../contexts/grouping/domain/group';
import { useTexts } from '../../texts/use-texts';
import { Chip } from '../kit/Chip';
import { Sheet } from '../kit/Sheet';
import { Wrap } from '../kit/Wrap';
import { PolicyActions } from './PolicyActions';

/** What a group does, changed from the status under its name: for good, or for a while. */
export const PolicySheet = observer(function PolicySheet({
  group,
  onClose,
  onForAWhile,
}: {
  readonly group: TGroup;
  readonly onClose: () => void;
  readonly onForAWhile: () => void;
}) {
  const texts = useTexts();
  return (
    <Sheet visible title={texts.group.whatItDoes} onClose={onClose} testID="policy-sheet">
      <PolicyActions group={group} onLeave={onClose} />
      <Wrap>
        <Chip
          testID="policy-for-a-while"
          label={`${texts.temporary.what}…`}
          onPress={onForAWhile}
        />
      </Wrap>
    </Sheet>
  );
});
