import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { usePalette } from '../theme/AppTheme';
import { TEXT_SIZE, TOUCH_SIZE } from './metrics';

const ICON_SIZE = 22;

/** The way up from a screen, above its title: an arrow and where it leads. */
export function BackLink({
  testID,
  label,
  onPress,
}: {
  readonly testID: string;
  readonly label: string;
  readonly onPress: () => void;
}) {
  const palette = usePalette();
  return (
    <Pressable testID={testID} accessibilityRole="link" onPress={onPress} style={styles.link}>
      <MaterialIcons name="arrow-back" size={ICON_SIZE} color={palette.fgDim} />
      <Text style={[styles.label, { color: palette.fgDim }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    minHeight: TOUCH_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  label: { fontSize: TEXT_SIZE.body },
});
