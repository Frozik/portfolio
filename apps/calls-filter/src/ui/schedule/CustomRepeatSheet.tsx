import { Minus, Plus } from 'lucide-react-native';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ScheduleEditor } from '../../contexts/policy/application/ScheduleEditor';
import type { IRecurrence, TWeekday } from '../../contexts/policy/domain/schedule';
import { useTexts } from '../../texts/use-texts';
import { Button } from '../kit/Button';
import { Chip } from '../kit/Chip';
import { Hint } from '../kit/Hint';
import { IconButton } from '../kit/IconButton';
import { GAP, TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { pickDate } from '../kit/pick-date';
import { Row } from '../kit/Row';
import { Section } from '../kit/Section';
import { Sheet } from '../kit/Sheet';
import { Wrap } from '../kit/Wrap';
import { usePalette } from '../theme/AppTheme';

const FREQUENCIES: readonly IRecurrence['frequency'][] = ['daily', 'weekly', 'monthly', 'yearly'];
const WEEK: readonly TWeekday[] = [1, 2, 3, 4, 5, 6, 7];
const DEFAULT_COUNT = 10;
const DAYS_TO_DEFAULT_END = 30;

function Stepper({
  value,
  onChange,
  testID,
}: {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly testID: string;
}) {
  const palette = usePalette();
  return (
    <View style={styles.stepper}>
      <IconButton
        testID={`${testID}-less`}
        icon={Minus}
        label="−"
        onPress={() => onChange(Math.max(1, value - 1))}
      />
      <Text testID={testID} style={[styles.value, { color: palette.fg }]}>
        {value}
      </Text>
      <IconButton
        testID={`${testID}-more`}
        icon={Plus}
        label="+"
        onPress={() => onChange(value + 1)}
      />
    </View>
  );
}

/** Google Calendar's «Custom recurrence»: every N units, on chosen weekdays, ending or not. */
export const CustomRepeatSheet = observer(function CustomRepeatSheet({
  editor,
  onClose,
}: {
  readonly editor: ScheduleEditor;
  readonly onClose: () => void;
}) {
  const texts = useTexts();
  const palette = usePalette();
  const [draft, setDraft] = useState<IRecurrence>(
    () =>
      editor.repeat ?? {
        frequency: 'weekly',
        interval: 1,
        weekdays: [],
        monthly: null,
        end: { kind: 'never' },
      }
  );
  const change = (patch: Partial<IRecurrence>) => setDraft({ ...draft, ...patch });
  const toggle = (weekday: TWeekday) =>
    change({
      weekdays: draft.weekdays.includes(weekday)
        ? draft.weekdays.filter(day => day !== weekday)
        : [...draft.weekdays, weekday].sort(),
    });
  const chooseEndDate = async () => {
    const initial =
      draft.end.kind === 'until' ? draft.end.date : editor.start.add({ days: DAYS_TO_DEFAULT_END });
    const date = await pickDate(initial, editor.start);
    if (date !== null) {
      change({ end: { kind: 'until', date } });
    }
  };
  const done = () => {
    editor.setRepeat(draft);
    onClose();
  };
  return (
    <Sheet visible title={texts.schedule.customTitle} onClose={onClose} testID="custom-repeat">
      <Hint text={texts.schedule.repeatsEvery} />
      <View style={styles.line}>
        <Stepper
          testID="custom-interval"
          value={draft.interval}
          onChange={interval => change({ interval })}
        />
        <Wrap>
          {FREQUENCIES.map(frequency => (
            <Chip
              key={frequency}
              testID={`custom-unit-${frequency}`}
              label={texts.schedule.unit(frequency, draft.interval)}
              selected={draft.frequency === frequency}
              onPress={() => change({ frequency })}
            />
          ))}
        </Wrap>
      </View>
      {draft.frequency === 'weekly' ? (
        <>
          <Hint text={texts.schedule.repeatsOn} />
          <View style={styles.week}>
            {WEEK.map(weekday => {
              const on = draft.weekdays.includes(weekday);
              return (
                <Pressable
                  key={weekday}
                  testID={`custom-weekday-${weekday}`}
                  accessibilityRole="checkbox"
                  accessibilityLabel={texts.format.weekdayShort(weekday)}
                  accessibilityState={{ checked: on }}
                  onPress={() => toggle(weekday)}
                  style={[
                    styles.day,
                    on
                      ? { backgroundColor: palette.accent }
                      : { borderColor: palette.line, borderWidth: StyleSheet.hairlineWidth * 2 },
                  ]}
                >
                  <Text style={[styles.dayText, { color: on ? palette.onAccent : palette.fg }]}>
                    {texts.schedule.weekdayLetter[weekday]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
      <Section title={texts.schedule.ends}>
        <Row
          testID="custom-end-never"
          title={`${draft.end.kind === 'never' ? '✓ ' : ''}${texts.schedule.never}`}
          onPress={() => change({ end: { kind: 'never' } })}
        />
        <Row
          testID="custom-end-date"
          title={`${draft.end.kind === 'until' ? '✓ ' : ''}${texts.schedule.onDate(
            draft.end.kind === 'until'
              ? texts.format.dayMonth(draft.end.date.day, draft.end.date.month)
              : '…'
          )}`}
          onPress={() => void chooseEndDate()}
        />
        <Row
          testID="custom-end-count"
          title={`${draft.end.kind === 'count' ? '✓ ' : ''}${texts.schedule.after(
            draft.end.kind === 'count' ? draft.end.count : DEFAULT_COUNT
          )}`}
          onPress={() =>
            change({
              end: {
                kind: 'count',
                count: draft.end.kind === 'count' ? draft.end.count : DEFAULT_COUNT,
              },
            })
          }
          trailing={
            draft.end.kind === 'count' ? (
              <Stepper
                testID="custom-count"
                value={draft.end.count}
                onChange={count => change({ end: { kind: 'count', count } })}
              />
            ) : undefined
          }
        />
      </Section>
      <Button testID="custom-done" label={texts.common.done} onPress={done} />
    </Sheet>
  );
});

const DAY_SIZE = 40;

const styles = StyleSheet.create({
  line: { gap: GAP },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  value: {
    minWidth: TOUCH_SIZE / 2,
    textAlign: 'center',
    fontSize: TEXT_SIZE.heading,
    fontWeight: '700',
  },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  day: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: DAY_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontSize: TEXT_SIZE.body, fontWeight: '600' },
});
