import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { GAP, GUTTER, RADIUS, TEXT_SIZE, TOUCH_SIZE } from './metrics';

const CLOSE_ICON_SIZE = 22;
/** The X keeps a full touch target without making the header taller than its title. */
const CLOSE_OVERHANG = -(TOUCH_SIZE - CLOSE_ICON_SIZE) / 2;

/** A decision the screen cannot go on without; the X, a tap outside and the back gesture close it as "not now". */
export function Dialog({
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
  const closeLabel = useVaultTexts().phone.close;
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.frame}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: palette.scrim }]}
        />
        <View
          testID={testID}
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: palette.bgElevated }]}
        >
          <View style={styles.header}>
            <Text accessibilityRole="header" style={[styles.title, { color: palette.fg }]}>
              {title}
            </Text>
            <Pressable
              testID="dialog-close"
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              onPress={onClose}
              style={styles.close}
            >
              <MaterialIcons name="close" size={CLOSE_ICON_SIZE} color={palette.fgDim} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, justifyContent: 'center', padding: GUTTER },
  sheet: { maxHeight: '90%', borderRadius: RADIUS, padding: 20, gap: GAP },
  content: { gap: GAP },
  header: { flexDirection: 'row', alignItems: 'center', gap: GAP },
  title: { flex: 1, fontSize: TEXT_SIZE.heading, fontWeight: '600' },
  close: {
    width: TOUCH_SIZE,
    height: TOUCH_SIZE,
    marginVertical: CLOSE_OVERHANG,
    marginRight: CLOSE_OVERHANG,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
