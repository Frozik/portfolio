import { useLocalSearchParams } from 'expo-router';
import { Plus, UserPlus } from 'lucide-react-native';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';

import type { TCalendarSource, TIcsId } from '../../contexts/calendars/domain/calendar-source';
import { sameCalendarSource } from '../../contexts/calendars/domain/calendar-source';
import type { TGroup, TGroupId } from '../../contexts/grouping/domain/group';
import { findGroup } from '../../contexts/grouping/domain/group-book';
import { changeGroup } from '../../contexts/grouping/domain/group-book-edits';
import type { TCountryCode } from '../../contexts/phone/domain/dialing-region';
import type { ICalendarRule, IEventFilter } from '../../contexts/policy/domain/policy';
import { narrowsNothing } from '../../contexts/policy/domain/policy';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { BackButton } from '../kit/BackButton';
import { Button } from '../kit/Button';
import { Chip } from '../kit/Chip';
import { Hint } from '../kit/Hint';
import { IconButton } from '../kit/IconButton';
import { Row } from '../kit/Row';
import { Screen } from '../kit/Screen';
import { Section } from '../kit/Section';
import { Sheet } from '../kit/Sheet';
import { TextField } from '../kit/TextField';
import { ToggleRow } from '../kit/ToggleRow';
import { Wrap } from '../kit/Wrap';

const DEFAULT_FILTER: IEventFilter = {
  busyOnly: true,
  skipDeclined: true,
  includeAllDay: false,
  minutesBefore: 0,
  minutesAfter: 0,
};
const HOLIDAYS_HERE: TCalendarSource = { kind: 'holidays-here' };

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
  const [holidaysOf, setHolidaysOf] = useState<TCountryCode | null>(null);
  const [state, setState] = useState<'idle' | 'checking' | 'failed'>('idle');
  const countries = [
    ...new Set(
      [app.device.networkCountry, app.device.simCountry].filter(
        (country): country is TCountryCode => country !== null
      )
    ),
  ];
  const add = async () => {
    setState('checking');
    const result = await app.calendars.addSubscription(label.trim(), url.trim(), holidaysOf);
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
      <Wrap>
        <Chip
          testID="ics-holidays-none"
          label="—"
          selected={holidaysOf === null}
          onPress={() => setHolidaysOf(null)}
        />
        {countries.map(country => (
          <Chip
            key={country}
            testID={`ics-holidays-${country}`}
            label={`${texts.schedule.holidays} ${country}`}
            selected={holidaysOf === country}
            onPress={() => setHolidaysOf(country)}
          />
        ))}
      </Wrap>
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
  return group.policy.scheduled?.calendars ?? [];
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
  const mode = rules[0]?.mode ?? 'except-events';
  const filter = rules[0]?.filter ?? DEFAULT_FILTER;
  const setRules = (next: readonly ICalendarRule[]) => {
    if (group === null) {
      return;
    }
    const { policy } = group;
    const opposite = policy.otherwise === 'block' ? 'pass' : 'block';
    const scheduled = policy.scheduled ?? { action: opposite, schedule: null, calendars: [] };
    const nextScheduled = { places: [], ...scheduled, calendars: next };
    app.books.run((book, context) =>
      changeGroup(
        book,
        group.id,
        {
          policy: {
            ...policy,
            scheduled: narrowsNothing(nextScheduled) ? null : nextScheduled,
          },
        },
        context.now
      )
    );
  };
  const isOn = (source: TCalendarSource) =>
    rules.some(rule => sameCalendarSource(rule.source, source));
  const toggle = (source: TCalendarSource) =>
    setRules(
      isOn(source)
        ? rules.filter(rule => !sameCalendarSource(rule.source, source))
        : [
            ...rules,
            {
              source,
              mode,
              filter:
                source.kind === 'holidays-here'
                  ? { ...filter, busyOnly: false, includeAllDay: true }
                  : filter,
            },
          ]
    );
  const setMode = (next: ICalendarRule['mode']) =>
    setRules(rules.map(rule => ({ ...rule, mode: next })));
  const setFilter = (next: Partial<IEventFilter>) =>
    setRules(rules.map(rule => ({ ...rule, filter: { ...rule.filter, ...next } })));
  const sourceRow = (source: TCalendarSource, title: string, subtitle?: string, testID?: string) =>
    group === null ? (
      <Row key={title} testID={testID} title={title} subtitle={subtitle} />
    ) : (
      <ToggleRow
        key={title}
        testID={testID ?? `calendar-${title}`}
        title={title}
        subtitle={subtitle}
        value={isOn(source)}
        onChange={() => toggle(source)}
      />
    );
  return (
    <Screen testID="calendars-screen" title={texts.calendars.title} header={<BackButton />}>
      {group === null ? null : (
        <>
          <Hint text={texts.calendars.mode} />
          <Wrap>
            <Chip
              testID="calendar-mode-except"
              label={texts.calendars.except}
              selected={mode === 'except-events'}
              onPress={() => setMode('except-events')}
            />
            <Chip
              testID="calendar-mode-only"
              label={texts.calendars.only}
              selected={mode === 'only-during-events'}
              onPress={() => setMode('only-during-events')}
            />
          </Wrap>
        </>
      )}
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
      <Section>
        {sourceRow(
          HOLIDAYS_HERE,
          texts.calendars.holidaysHere,
          [...app.calendars.holidays.keys()].join(', '),
          'calendar-holidays-here'
        )}
      </Section>
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
                calendar.isHolidayCalendar ? `${account} · ${texts.schedule.holidays}` : account,
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
            if (group !== null && !isOn(source)) {
              toggle(source);
            }
          }}
          onClose={() => setAdding(false)}
        />
      ) : null}
      {group === null ? (
        <>
          <Section title={texts.calendars.holidaysByCountry}>
            {app.calendars.deviceCalendars
              .filter(calendar => calendar.isHolidayCalendar)
              .map(calendar => {
                const source: TCalendarSource = {
                  kind: 'device',
                  accountType: calendar.accountType,
                  accountName: calendar.accountName,
                  calendarName: calendar.calendarName,
                };
                const country =
                  [...app.calendars.holidays].find(([, mapped]) =>
                    sameCalendarSource(mapped, source)
                  )?.[0] ?? null;
                const candidates = [
                  ...new Set(
                    [app.device.networkCountry, app.device.simCountry].filter(
                      (code): code is TCountryCode => code !== null
                    )
                  ),
                ];
                return (
                  <Row
                    key={calendar.id}
                    title={calendar.calendarName}
                    subtitle={country ?? '—'}
                    trailing={
                      <Wrap>
                        {candidates.map(code => (
                          <Chip
                            key={code}
                            label={code}
                            selected={code === country}
                            onPress={() =>
                              app.calendars.setHolidayCountry(
                                source,
                                code === country ? null : code
                              )
                            }
                          />
                        ))}
                      </Wrap>
                    }
                  />
                );
              })}
          </Section>
        </>
      ) : (
        <>
          <Section>
            <ToggleRow
              testID="filter-busy"
              title={texts.calendars.busyOnly}
              value={filter.busyOnly}
              onChange={busyOnly => setFilter({ busyOnly })}
            />
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
