import { useRouter } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { observer } from 'mobx-react-lite';

import type { TGroup } from '../../contexts/grouping/domain/group';
import { changeGroup } from '../../contexts/grouping/domain/group-book-edits';
import type { TAction } from '../../contexts/policy/domain/action';
import type { IPolicy } from '../../contexts/policy/domain/policy';
import { hiddenCallsMissRepeat } from '../../contexts/screening/domain/hidden-repeat';
import { policyText, scheduleText } from '../../texts/policy-phrase';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { useCalendarName } from '../calendars/use-calendar-name';
import { useClockWords } from '../clock-words';
import { Chip } from '../kit/Chip';
import { Hint } from '../kit/Hint';
import { IconButton } from '../kit/IconButton';
import { Row } from '../kit/Row';
import { Section } from '../kit/Section';
import { Wrap } from '../kit/Wrap';
import { PlaceStateMark } from '../place/PlaceStateMark';
import { RepeatRow } from '../repeat/RepeatRow';

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

/** «What to do»: one action always, or one in the windows and another the rest of the time. */
export const PolicyPanel = observer(function PolicyPanel({ group }: { readonly group: TGroup }) {
  const app = useApp();
  const texts = useTexts();
  const router = useRouter();
  const calendarName = useCalendarName();
  const clockWords = useClockWords();
  const { policy } = group;
  const setPolicy = (next: IPolicy) =>
    app.books.run((book, context) => changeGroup(book, group.id, { policy: next }, context.now));
  const { scheduled } = policy;
  return (
    <>
      {scheduled === null ? (
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
              onPress={() => router.push({ pathname: '/schedule', params: { group: group.id } })}
            />
            <Chip
              testID="add-calendars"
              label={texts.group.addCalendars}
              onPress={() => router.push({ pathname: '/calendars', params: { group: group.id } })}
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
              onPress={() => router.push({ pathname: '/schedule', params: { group: group.id } })}
            />
            <Row
              testID="open-calendars"
              title={texts.group.calendars}
              subtitle={scheduled.calendars.map(rule => calendarName(rule.source)).join(', ')}
              onPress={() => router.push({ pathname: '/calendars', params: { group: group.id } })}
            />
          </Section>
          <Hint text={texts.group.otherwise} />
          <ActionChips
            prefix="otherwise"
            value={policy.otherwise}
            onChange={otherwise => setPolicy({ ...policy, otherwise })}
          />
        </>
      )}
      <Section
        title={texts.place.title}
        actions={
          <IconButton
            testID="add-place"
            icon={MapPin}
            label={texts.place.add}
            onPress={() => router.push({ pathname: '/place', params: { group: group.id } })}
          />
        }
      >
        {(scheduled?.places ?? []).map(place => {
          const here = app.places.atPlace(place.id);
          return (
            <Row
              key={place.id}
              testID={`place-${place.id}`}
              title={place.name}
              subtitle={[
                texts.place.radius(place.radius),
                place.mode === 'only-at' ? texts.place.onlyAt : texts.place.exceptAt,
                here === null ? texts.place.unknown : here ? texts.place.at : texts.place.away,
              ].join(' · ')}
              trailing={<PlaceStateMark here={here} />}
              onPress={() =>
                router.push({ pathname: '/place', params: { group: group.id, place: place.id } })
              }
            />
          );
        })}
        {(scheduled?.places.length ?? 0) === 0 ? (
          <Row
            testID="add-place-row"
            title={texts.place.add}
            onPress={() => router.push({ pathname: '/place', params: { group: group.id } })}
          />
        ) : null}
      </Section>
      <Section>
        <RepeatRow
          testID="group-repeat"
          value={policy.repeatPass}
          hint={texts.repeat.groupHint(policy.repeatWindowMinutes)}
          onChange={repeatPass => setPolicy({ ...policy, repeatPass })}
        />
      </Section>
      {hiddenCallsMissRepeat(
        app.books.book,
        group,
        app.environment,
        app.device.preferences.repeatPass,
        app.clock.now()
      ) ? (
        <Hint testID="repeat-hidden-miss" tone="caution" text={texts.repeat.hiddenMiss} />
      ) : null}
      <Hint
        testID="policy-phrase"
        text={`«${policyText(texts, policy, calendarName, clockWords)}»`}
      />
    </>
  );
});
