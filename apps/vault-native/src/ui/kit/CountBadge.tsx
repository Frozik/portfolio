import { StyleSheet, Text, View } from 'react-native';

import { usePalette } from '../theme/AppTheme';

const BADGE_SIZE = 18;
const BADGE_TEXT_SIZE = 11;
/** A count past this shows as `99+`, so the badge keeps its width. */
const MOST_SHOWN = 99;

/** A count in a small round badge: red for what needs attention, grey for what is only counted. */
export function CountBadge({
  count,
  tone = 'danger',
  testID,
}: {
  readonly count: number;
  readonly tone?: 'danger' | 'neutral';
  readonly testID?: string;
}) {
  const palette = usePalette();
  return (
    <View
      testID={testID}
      style={[
        styles.badge,
        { backgroundColor: tone === 'danger' ? palette.danger : palette.fgFaint },
      ]}
    >
      <Text style={[styles.text, { color: palette.bg }]}>
        {count > MOST_SHOWN ? `${MOST_SHOWN}+` : count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontSize: BADGE_TEXT_SIZE, fontWeight: '700' },
});
