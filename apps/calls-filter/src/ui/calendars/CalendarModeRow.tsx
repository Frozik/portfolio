import { StyleSheet, Text, View } from 'react-native';

import type { ICalendarRule } from '../../contexts/policy/domain/policy';
import { useTexts } from '../../texts/use-texts';
import { GUTTER, SMALL_GAP, TEXT_SIZE } from '../kit/metrics';
import { SegmentedControl } from '../kit/SegmentedControl';
import { usePalette } from '../theme/AppTheme';

/** How a group treats one calendar: not at all, only during its events, or outside them. */
export type TCalendarUse = 'off' | ICalendarRule['mode'];

/** A calendar of the list with the switch of how the group uses it. */
export function CalendarModeRow({
  title,
  subtitle,
  value,
  onChange,
  testID,
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly value: TCalendarUse;
  readonly onChange: (value: TCalendarUse) => void;
  readonly testID: string;
}) {
  const palette = usePalette();
  const texts = useTexts();
  return (
    <View testID={testID} style={[styles.row, { borderBottomColor: palette.lineSoft }]}>
      <Text style={[styles.title, { color: palette.fg }]} numberOfLines={1}>
        {title}
      </Text>
      {subtitle === undefined ? null : (
        <Text style={[styles.subtitle, { color: palette.fgDim }]} numberOfLines={1}>
          {subtitle}
        </Text>
      )}
      <SegmentedControl
        compact
        segments={[
          { value: 'off', label: texts.calendars.useOff, testID: `${testID}-off` },
          { value: 'only-during-events', label: texts.calendars.useOnly, testID: `${testID}-only` },
          { value: 'except-events', label: texts.calendars.useExcept, testID: `${testID}-except` },
        ]}
        value={value}
        onChange={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: GUTTER,
    paddingVertical: 10,
    gap: SMALL_GAP,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: TEXT_SIZE.body, fontWeight: '500' },
  subtitle: { fontSize: TEXT_SIZE.small },
});
