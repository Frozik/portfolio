import { useLocalSearchParams } from 'expo-router';
import { Plus, UserPlus } from 'lucide-react-native';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';

import type { TCalendarSource, TIcsId } from '../../contexts/calendars/domain/calendar-source';
import { sameCalendarSource } from '../../contexts/calendars/domain/calendar-source';
import type { TGroup, TGroupId } from '../../contexts/grouping/domain/group';
import { findGroup } from '../../contexts/grouping/domain/group-book';
import { changeGroup } from '../../contexts/grouping/domain/group-book-edits';
import type { ICalendarRule, IEventFilter } from '../../contexts/policy/domain/policy';
import { withConditions } from '../../contexts/policy/domain/policy';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { BackArrow } from '../kit/BackArrow';
import { Button } from '../kit/Button';
import { Hint } from '../kit/Hint';
import { IconButton } from '../kit/IconButton';
import { Row } from '../kit/Row';
import { Screen } from '../kit/Screen';
import { Section } from '../kit/Section';
import { Sheet } from '../kit/Sheet';
import { TextField } from '../kit/TextField';
import { ToggleRow } from '../kit/ToggleRow';
import type { TCalendarUse } from './CalendarModeRow';
import { CalendarModeRow } from './CalendarModeRow';

const DEFAULT_FILTER: IEventFilter = {
  skipDeclined: true,
  includeAllDay: false,
  minutesBefore: 0,
  minutesAfter: 0,
};

/** Adds an iCal link: a name, the URL, a probe before saving, and where to find the link. */
const AddIcsSheet = observer(function AddIcsSheet({
  onAdded,
  onClose,
}: {
  readonly onAdded: (id: TIcsId) => void;
  readonly onClose: () => void;
}) {
  const app = useApp();
  const texts = useTexts();
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [state, setState] = useState<'idle' | 'checking' | 'failed'>('idle');
  const add = async () => {
    setState('checking');
    const result = await app.calendars.addSubscription(label.trim(), url.trim());
    if (result.kind === 'added') {
      onAdded(result.id);
      onClose();
    } else {
      setState('failed');
    }
  };
  return (
    <Sheet visible title={texts.calendars.addIcs} onClose={onClose} testID="ics-sheet">
      <TextField
        testID="ics-label"
        label={texts.calendars.icsName}
        value={label}
        onChange={setLabel}
        placeholder={texts.calendars.icsName}
      />
      <TextField
        testID="ics-url"
        label={texts.calendars.icsUrl}
        value={url}
        onChange={setUrl}
        placeholder={texts.calendars.icsUrl}
      />
      <Hint text={texts.calendars.whereToGet} />
      {state === 'failed' ? (
        <Hint testID="ics-failed" tone="danger" text={texts.calendars.failed} />
      ) : null}
      <Button
        testID="ics-add"
        label={texts.calendars.addIcs}
        disabled={url.trim() === '' || label.trim() === '' || state === 'checking'}
        onPress={() => void add()}
      />
    </Sheet>
  );
});

function rulesOf(group: TGroup): readonly ICalendarRule[] {
  return group.policy.conditions?.calendars ?? [];
}

/** The calendars of the phone and the links; with a group, the calendar rule of its policy. */
export const CalendarsScreen = observer(function CalendarsScreen() {
  const app = useApp();
  const texts = useTexts();
  const { group: groupId } = useLocalSearchParams<{ readonly group?: string }>();
  const group = groupId === undefined ? null : findGroup(app.books.book, groupId as TGroupId);
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    void app.calendars.refresh();
  }, [app]);
  const rules = group === null ? [] : rulesOf(group);
  const filter = rules[0]?.filter ?? DEFAULT_FILTER;
  const setRules = (next: readonly ICalendarRule[]) => {
    if (group === null) {
      return;
    }
    const { policy } = group;
    const conditions = policy.conditions ?? { schedule: null, calendars: [] };
    const nextConditions = { places: [], ...conditions, calendars: next };
    app.books.run((book, context) =>
      changeGroup(book, group.id, { policy: withConditions(policy, nextConditions) }, context.now)
    );
  };
  const calendarUseOf = (source: TCalendarSource): TCalendarUse =>
    rules.find(rule => sameCalendarSource(rule.source, source))?.mode ?? 'off';
  const setCalendarUse = (source: TCalendarSource, use: TCalendarUse) => {
    const others = rules.filter(rule => !sameCalendarSource(rule.source, source));
    setRules(use === 'off' ? others : [...others, { source, mode: use, filter }]);
  };
  const setFilter = (next: Partial<IEventFilter>) =>
    setRules(rules.map(rule => ({ ...rule, filter: { ...rule.filter, ...next } })));
  const sourceRow = (
    source: TCalendarSource,
    title: string,
    subtitle: string | undefined,
    testID: string
  ) =>
    group === null ? (
      <Row key={testID} testID={testID} title={title} subtitle={subtitle} />
    ) : (
      <CalendarModeRow
        key={testID}
        testID={testID}
        title={title}
        subtitle={subtitle}
        value={calendarUseOf(source)}
        onChange={use => setCalendarUse(source, use)}
      />
    );
  return (
    <Screen
      testID="calendars-screen"
      title={texts.calendars.title}
      titleLeading={<BackArrow testID="screen-back" />}
    >
      {app.device.permissions.calendar === 'granted' ? null : (
        <Section>
          <Hint text={texts.calendars.noPermission} />
          <Button
            testID="calendar-grant"
            label={texts.calendars.grant}
            onPress={() => void app.device.request('calendar').then(() => app.calendars.refresh())}
          />
        </Section>
      )}
      {app.device.permissions.calendar === 'granted' && app.calendars.byAccount.size === 0 ? (
        <Section testID="calendars-none">
          <Row title={texts.calendars.none} subtitle={texts.calendars.noneHint} />
          <Row
            testID="calendars-add-account"
            title={texts.calendars.addAccount}
            onPress={() => app.openSettings('add-account')}
            trailing={
              <IconButton
                testID="calendars-add-account-icon"
                icon={UserPlus}
                label={texts.calendars.addAccount}
                onPress={() => app.openSettings('add-account')}
              />
            }
          />
        </Section>
      ) : null}
      {app.calendars.byAccount.size === 0 ? null : (
        <Section title={texts.calendars.phoneCalendars}>
          {[...app.calendars.byAccount].flatMap(([account, calendars]) =>
            calendars.map(calendar => {
              const source: TCalendarSource = {
                kind: 'device',
                accountType: calendar.accountType,
                accountName: calendar.accountName,
                calendarName: calendar.calendarName,
              };
              return sourceRow(
                source,
                calendar.calendarName,
                account,
                `calendar-device-${calendar.id}`
              );
            })
          )}
        </Section>
      )}
      <Section title={texts.calendars.ics}>
        {app.calendars.subscriptions.map(subscription =>
          sourceRow(
            { kind: 'ics', id: subscription.id },
            subscription.label,
            subscription.failedAt === null ? undefined : texts.calendars.failed,
            `calendar-ics-${subscription.id}`
          )
        )}
        <Row
          testID="ics-add-open"
          title={texts.calendars.addIcs}
          onPress={() => setAdding(true)}
          trailing={
            <IconButton
              testID="ics-add-open-icon"
              icon={Plus}
              label={texts.calendars.addIcs}
              onPress={() => setAdding(true)}
            />
          }
        />
      </Section>
      {adding ? (
        <AddIcsSheet
          onAdded={id => {
            const source: TCalendarSource = { kind: 'ics', id };
            if (group !== null && calendarUseOf(source) === 'off') {
              setCalendarUse(source, 'except-events');
            }
          }}
          onClose={() => setAdding(false)}
        />
      ) : null}
      {group === null ? null : (
        <>
          <Section>
            <ToggleRow
              testID="filter-declined"
              title={texts.calendars.skipDeclined}
              value={filter.skipDeclined}
              onChange={skipDeclined => setFilter({ skipDeclined })}
            />
            <ToggleRow
              testID="filter-all-day"
              title={texts.calendars.includeAllDay}
              value={filter.includeAllDay}
              onChange={includeAllDay => setFilter({ includeAllDay })}
            />
          </Section>
        </>
      )}
    </Screen>
  );
});
