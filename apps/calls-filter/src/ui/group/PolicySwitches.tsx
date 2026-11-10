import { observer } from 'mobx-react-lite';

import type { TGroup } from '../../contexts/grouping/domain/group';
import { changeGroup } from '../../contexts/grouping/domain/group-book-edits';
import { actionOf, withAction } from '../../contexts/policy/domain/policy';
import { useApp } from '../AppContext';
import { ActionSwitch } from './ActionSwitch';

/**
 * What a group does: always, or — once it has a schedule, calendars or places — while they all
 * hold, with the opposite the rest of the time.
 */
export const PolicySwitches = observer(function PolicySwitches({
  group,
}: {
  readonly group: TGroup;
}) {
  const app = useApp();
  const { policy } = group;
  return (
    <ActionSwitch
      prefix={policy.scheduled === null ? 'always' : 'while'}
      value={actionOf(policy)}
      onChange={action =>
        app.books.run((book, context) =>
          changeGroup(book, group.id, { policy: withAction(policy, action) }, context.now)
        )
      }
    />
  );
});
