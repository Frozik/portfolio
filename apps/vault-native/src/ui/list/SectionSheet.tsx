import { observer } from 'mobx-react-lite';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { VaultView } from '@frozik/vault-app/document/application/VaultView';
import type { TVaultSection } from '@frozik/vault-app/navigation/vault-pages';

import { GUTTER, RADIUS, TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { sectionLabelOf } from './section-label';

/** The sections and groups in a sheet from the bottom; picking one closes it. */
export const SectionSheet = observer(function SectionSheet({
  view,
  open,
  onPick,
  onClose,
}: {
  readonly view: VaultView;
  readonly open: boolean;
  readonly onPick: (section: TVaultSection) => void;
  readonly onClose: () => void;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const t = useVaultTexts();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.phone.close}
        onPress={onClose}
        style={[styles.scrim, { backgroundColor: palette.scrim }]}
      />
      <View
        testID="section-sheet"
        style={[
          styles.sheet,
          { backgroundColor: palette.bgElevated, paddingBottom: insets.bottom + GUTTER },
        ]}
      >
        <Text accessibilityRole="header" style={[styles.title, { color: palette.fg }]}>
          {t.phone.sections}
        </Text>
        <ScrollView>
          {view.sections.map(entry => {
            const current = view.section === entry.section;
            return (
              <Pressable
                key={entry.section}
                testID={`section-${entry.section}`}
                accessibilityRole="link"
                accessibilityState={{ selected: current }}
                onPress={() => onPick(entry.section)}
                style={[styles.entry, current && { backgroundColor: palette.bgCard }]}
              >
                <Text numberOfLines={1} style={[styles.label, { color: palette.fg }]}>
                  {sectionLabelOf(t, entry)}
                </Text>
                <Text style={[styles.count, { color: palette.fgFaint }]}>{entry.count}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
});

const SHEET_MAX_SHARE = '70%';

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
  entry: {
    minHeight: TOUCH_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
  },
  label: { flex: 1, fontSize: TEXT_SIZE.body },
  count: { fontSize: TEXT_SIZE.small },
});
