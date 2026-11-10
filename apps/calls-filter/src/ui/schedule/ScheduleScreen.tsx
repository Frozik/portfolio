import { useLocalSearchParams } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { Temporal } from 'temporal-polyfill';

import type { TGroupId } from '../../contexts/grouping/domain/group';
import { findGroup } from '../../contexts/grouping/domain/group-book';
import { changeGroup } from '../../contexts/grouping/domain/group-book-edits';
import { ScheduleEditor, withSchedule } from '../../contexts/policy/application/ScheduleEditor';
import { plainDateTimeOf } from '../../contexts/policy/domain/floating-time';
import type { TWeekday } from '../../contexts/policy/domain/schedule';
import { scheduleText } from '../../texts/policy-phrase';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { useClockWords } from '../clock-words';
import { momentText } from '../format';
import { BackArrow } from '../kit/BackArrow';
import { Button } from '../kit/Button';
import { Hint } from '../kit/Hint';
import { IconButton } from '../kit/IconButton';
import { TEXT_SIZE } from '../kit/metrics';
import { pickDate } from '../kit/pick-date';
import { pickTime } from '../kit/pick-time';
import { Row } from '../kit/Row';
import { Screen } from '../kit/Screen';
import { Section } from '../kit/Section';
import { ToggleRow } from '../kit/ToggleRow';
import { useLeave } from '../kit/use-leave';
import { usePalette } from '../theme/AppTheme';
import { CustomRepeatSheet } from './CustomRepeatSheet';
import { gmtOffset } from './gmt-offset';
import { presetLabel } from './repeat-label';
import { RepeatMenuSheet } from './RepeatMenuSheet';
import { ZoneSheet } from './ZoneSheet';

type TOpenSheet = 'repeat' | 'custom' | 'zone' | null;

const TimeRows = observer(function TimeRows({ editor }: { readonly editor: ScheduleEditor }) {
  const texts = useTexts();
  const palette = usePalette();
  const choose = async (index: number, end: 'from' | 'to', current: Temporal.PlainTime) => {
    const time = await pickTime(current);
    if (time !== null) {
      editor.setTime(index, end, time);
    }
  };
  const several = editor.times.length > 1;
  return editor.times.map((time, index) =>
    time.kind === 'all-day' ? null : (
      <Section key={`${time.from.toString()}-${time.to.toString()}`}>
        {(['from', 'to'] as const).map(end => (
          <Row
            key={end}
            testID={`time-${index}-${end}`}
            title={end === 'from' ? texts.schedule.from : texts.schedule.to}
            onPress={() => void choose(index, end, time[end])}
            trailing={
              <Text style={[styles.time, { color: palette.fg }]}>
                {texts.format.time(time[end].hour, time[end].minute)}
              </Text>
            }
          />
        ))}
        {several ? (
          <Row
            testID={`time-${index}-remove`}
            title={texts.schedule.removeTime}
            onPress={() => editor.removeTime(index)}
            trailing={
              <IconButton
                testID={`time-${index}-remove-icon`}
                icon={Trash2}
                label={texts.schedule.removeTime}
                onPress={() => editor.removeTime(index)}
              />
            }
          />
        ) : null}
      </Section>
    )
  );
});

/** A group's schedule, laid out like a Google Calendar event: times, start, repeat, zone. */
export const ScheduleScreen = observer(function ScheduleScreen() {
  const app = useApp();
  const texts = useTexts();
  const leave = useLeave();
  const clockWords = useClockWords();
  const { group: groupId } = useLocalSearchParams<{ readonly group: string }>();
  const group = findGroup(app.books.book, groupId as TGroupId);
  const today = app.clock.localNow().toPlainDate();
  const [editor] = useState(
    () =>
      new ScheduleEditor(
        group?.policy.conditions?.schedule ?? null,
        today,
        app.device.timeZone,
        app.expander
      )
  );
  const [sheet, setSheet] = useState<TOpenSheet>(null);
  if (group === null) {
    return null;
  }
  const save = (remove: boolean) => {
    app.books.run((book, context) =>
      changeGroup(
        book,
        group.id,
        {
          policy: withSchedule(group.policy, remove ? null : editor.schedule),
        },
        context.now
      )
    );
    leave();
  };
  const chooseStart = async () => {
    const date = await pickDate(editor.start, today);
    if (date !== null) {
      editor.setStart(date);
    }
  };
  const { start, zone } = editor;
  const zoneLabel =
    zone.kind === 'here'
      ? texts.schedule.zoneHere
      : `${app.zoneCity(zone.zone)} (${gmtOffset(
          app.timeZones.find(known => known.id === zone.zone)?.offsetMinutes ?? 0
        )})`;
  return (
    <Screen
      testID="schedule-screen"
      title={texts.schedule.title}
      titleLeading={<BackArrow testID="screen-back" />}
      footer={
        <>
          <Button testID="schedule-save" label={texts.common.save} onPress={() => save(false)} />
          {group.policy.conditions?.schedule === null || group.policy.conditions === null ? null : (
            <Button
              testID="schedule-remove"
              variant="danger"
              label={texts.schedule.remove}
              onPress={() => save(true)}
            />
          )}
        </>
      }
    >
      <Section>
        <ToggleRow
          testID="schedule-all-day"
          title={texts.schedule.allDay}
          value={editor.allDay}
          onChange={allDay => editor.setAllDay(allDay)}
        />
      </Section>
      <TimeRows editor={editor} />
      {editor.allDay ? null : (
        <Section>
          <Row
            testID="schedule-add-time"
            title={texts.schedule.addTime}
            onPress={() => editor.addTime()}
            trailing={
              <IconButton
                testID="schedule-add-time-icon"
                icon={Plus}
                label={texts.schedule.addTime}
                onPress={() => editor.addTime()}
              />
            }
          />
        </Section>
      )}
      <Section>
        <Row
          testID="schedule-start"
          title={texts.schedule.starts}
          subtitle={`${texts.format.weekdayShort(start.dayOfWeek as TWeekday)}, ${texts.format.dayMonth(start.day, start.month)} ${start.year}`}
          onPress={() => void chooseStart()}
        />
        <Row
          testID="schedule-repeat"
          title={texts.schedule.repeat}
          subtitle={
            editor.preset === 'custom'
              ? texts.schedule.custom
              : presetLabel(texts, editor.preset, start)
          }
          onPress={() => setSheet('repeat')}
        />
        <Row
          testID="schedule-zone"
          title={texts.schedule.timeZone}
          subtitle={zoneLabel}
          onPress={() => setSheet('zone')}
        />
      </Section>
      <Hint testID="schedule-phrase" text={scheduleText(texts, editor.schedule, clockWords)} />
      <Hint
        text={`${texts.schedule.upcoming}: ${editor.upcoming
          .map(
            window =>
              `${momentText(texts, plainDateTimeOf(window.from), today)}–${momentText(texts, plainDateTimeOf(window.to), plainDateTimeOf(window.from).toPlainDate())}`
          )
          .join(' · ')}`}
      />
      {sheet === 'repeat' ? (
        <RepeatMenuSheet
          editor={editor}
          onCustom={() => setSheet('custom')}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'custom' ? (
        <CustomRepeatSheet editor={editor} onClose={() => setSheet(null)} />
      ) : null}
      {sheet === 'zone' ? <ZoneSheet editor={editor} onClose={() => setSheet(null)} /> : null}
    </Screen>
  );
});

const styles = StyleSheet.create({
  time: { fontSize: TEXT_SIZE.heading, fontWeight: '700' },
});
