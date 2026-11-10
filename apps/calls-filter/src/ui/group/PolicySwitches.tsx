import { observer } from 'mobx-react-lite';

import type { TGroup } from '../../contexts/grouping/domain/group';
import { changeGroup } from '../../contexts/grouping/domain/group-book-edits';
import type { IPolicy } from '../../contexts/policy/domain/policy';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { Hint } from '../kit/Hint';
import { ActionSwitch } from './ActionSwitch';

/**
 * What a group does: one action always, or — once it has a schedule, calendars or places — the
 * action for the rest of the time; the one while they hold is set beside them.
 */
export const PolicySwitches = observer(function PolicySwitches({
  group,
}: {
  readonly group: TGroup;
}) {
  const app = useApp();
  const texts = useTexts();
  const { policy } = group;
  const setPolicy = (next: IPolicy) =>
    app.books.run((book, context) => changeGroup(book, group.id, { policy: next }, context.now));
  const { scheduled } = policy;
  return scheduled === null ? (
    <ActionSwitch
      prefix="always"
      value={policy.otherwise}
      onChange={otherwise => setPolicy({ ...policy, otherwise })}
    />
  ) : (
    <>
      <Hint text={texts.group.otherwise} />
      <ActionSwitch
        prefix="otherwise"
        value={policy.otherwise}
        onChange={otherwise => setPolicy({ ...policy, otherwise })}
      />
    </>
  );
});
