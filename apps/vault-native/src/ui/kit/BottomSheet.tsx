import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { GUTTER, RADIUS, TEXT_SIZE } from './metrics';

const SHEET_MAX_SHARE = '70%';

/** A sheet from the bottom over the screen, as the sections' one: a tap outside or back closes it. */
export function BottomSheet({
  open,
  title,
  onClose,
  testID,
  children,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly testID?: string;
  readonly children: ReactNode;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const closeLabel = useVaultTexts().phone.close;
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        onPress={onClose}
        style={[styles.scrim, { backgroundColor: palette.scrim }]}
      />
      <View
        testID={testID}
        accessibilityViewIsModal
        style={[
          styles.sheet,
          { backgroundColor: palette.bgElevated, paddingBottom: insets.bottom + GUTTER },
        ]}
      >
        <Text accessibilityRole="header" style={[styles.title, { color: palette.fg }]}>
          {title}
        </Text>
        <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  sheet: {
    maxHeight: SHEET_MAX_SHARE,
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    paddingTop: GUTTER,
  },
  title: {
    fontSize: TEXT_SIZE.heading,
    fontWeight: '600',
    paddingHorizontal: GUTTER,
    paddingBottom: 8,
  },
});
