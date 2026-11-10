import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePalette } from '../theme/AppTheme';
import { GAP, GUTTER, RADIUS, TEXT_SIZE } from './metrics';

/** A bottom sheet over the screen: a tap outside or back closes it. */
export function Sheet({
  visible,
  title,
  onClose,
  testID,
  children,
}: {
  readonly visible: boolean;
  /** The sheet's heading; a sheet whose contents say what it is for goes without. */
  readonly title?: string;
  readonly onClose: () => void;
  readonly testID?: string;
  readonly children: ReactNode;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      {/* Edge to edge, Android no longer shrinks the window for the keyboard: the sheet rises itself. */}
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <Pressable
          style={[styles.scrim, { backgroundColor: palette.scrim }]}
          onPress={onClose}
          accessibilityLabel={title}
        />
        <View
          testID={testID}
          style={[
            styles.sheet,
            { backgroundColor: palette.bgElevated, paddingBottom: insets.bottom + GUTTER },
          ]}
        >
          {title === undefined ? null : (
            <Text
              testID={testID === undefined ? undefined : `${testID}-title`}
              style={[styles.title, { color: palette.fg }]}
            >
              {title}
            </Text>
          )}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const SHEET_MAX_HEIGHT = '85%';

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrim: { flex: 1 },
  sheet: {
    maxHeight: SHEET_MAX_HEIGHT,
    borderTopLeftRadius: RADIUS * 2,
    borderTopRightRadius: RADIUS * 2,
    padding: GUTTER,
    gap: GAP,
  },
  title: { fontSize: TEXT_SIZE.heading, fontWeight: '700' },
  content: { gap: GAP },
});
