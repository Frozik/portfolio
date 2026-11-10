import { observer } from 'mobx-react-lite';

import type { TGroup } from '../../contexts/grouping/domain/group';
import { changeGroup } from '../../contexts/grouping/domain/group-book-edits';
import { useApp } from '../AppContext';
import { ActionSwitch } from './ActionSwitch';

/** What a group does with the calls it takes: always, or — once it has conditions — while they all hold. */
export const PolicySwitches = observer(function PolicySwitches({
  group,
}: {
  readonly group: TGroup;
}) {
  const app = useApp();
  const { policy } = group;
  return (
    <ActionSwitch
      prefix={policy.conditions === null ? 'always' : 'while'}
      value={policy.action}
      onChange={action =>
        app.books.run((book, context) =>
          changeGroup(book, group.id, { policy: { ...policy, action } }, context.now)
        )
      }
    />
  );
});
