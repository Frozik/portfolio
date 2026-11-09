import { useRouter } from 'expo-router';
import { observer } from 'mobx-react-lite';

import type { TGroup } from '../../contexts/grouping/domain/group';
import { changeGroup } from '../../contexts/grouping/domain/group-book-edits';
import type { TAction } from '../../contexts/policy/domain/action';
import type { IPolicy } from '../../contexts/policy/domain/policy';
import { scheduleText } from '../../texts/policy-phrase';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { useCalendarName } from '../calendars/use-calendar-name';
import { useClockWords } from '../clock-words';
import { Chip } from '../kit/Chip';
import { Hint } from '../kit/Hint';
import { Row } from '../kit/Row';
import { Section } from '../kit/Section';
import { Wrap } from '../kit/Wrap';

const ACTIONS: readonly TAction[] = ['block', 'pass'];

function ActionChips({
  value,
  onChange,
  prefix,
}: {
  readonly value: TAction;
  readonly onChange: (action: TAction) => void;
  readonly prefix: string;
}) {
  const texts = useTexts();
  return (
    <Wrap>
      {ACTIONS.map(action => (
        <Chip
          key={action}
          testID={`${prefix}-${action}`}
          label={texts.actions[action]}
          selected={action === value}
          onPress={() => onChange(action)}
        />
      ))}
    </Wrap>
  );
}

/** What a group does: one action always, or one in the windows and another the rest of the time. */
export const PolicyActions = observer(function PolicyActions({
  group,
  onLeave,
}: {
  readonly group: TGroup;
  /** Called before it opens the schedule or the calendars: a sheet holding it closes then. */
  readonly onLeave?: () => void;
}) {
  const app = useApp();
  const texts = useTexts();
  const router = useRouter();
  const calendarName = useCalendarName();
  const clockWords = useClockWords();
  const { policy } = group;
  const setPolicy = (next: IPolicy) =>
    app.books.run((book, context) => changeGroup(book, group.id, { policy: next }, context.now));
  const { scheduled } = policy;
  const open = (pathname: '/schedule' | '/calendars') => {
    onLeave?.();
    router.push({ pathname, params: { group: group.id } });
  };
  return scheduled === null ? (
    <>
      <Hint text={texts.group.always} />
      <ActionChips
        prefix="always"
        value={policy.otherwise}
        onChange={otherwise => setPolicy({ ...policy, otherwise })}
      />
      <Wrap>
        <Chip
          testID="add-schedule"
          label={texts.group.addSchedule}
          onPress={() => open('/schedule')}
        />
        <Chip
          testID="add-calendars"
          label={texts.group.addCalendars}
          onPress={() => open('/calendars')}
        />
      </Wrap>
    </>
  ) : (
    <>
      <Hint text={texts.group.inWindows} />
      <ActionChips
        prefix="scheduled"
        value={scheduled.action}
        onChange={action => setPolicy({ ...policy, scheduled: { ...scheduled, action } })}
      />
      <Section>
        <Row
          testID="open-schedule"
          title={texts.group.schedule}
          subtitle={
            scheduled.schedule === null
              ? texts.group.noSchedule
              : scheduleText(texts, scheduled.schedule, clockWords)
          }
          onPress={() => open('/schedule')}
        />
        <Row
          testID="open-calendars"
          title={texts.group.calendars}
          subtitle={scheduled.calendars.map(rule => calendarName(rule.source)).join(', ')}
          onPress={() => open('/calendars')}
        />
      </Section>
      <Hint text={texts.group.otherwise} />
      <ActionChips
        prefix="otherwise"
        value={policy.otherwise}
        onChange={otherwise => setPolicy({ ...policy, otherwise })}
      />
    </>
  );
});
