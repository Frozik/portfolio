import type { TGroupId } from '@frozik/vault/model/ids';
import { isNil } from 'lodash-es';
import { Pencil } from 'lucide-react-native';
import { observer } from 'mobx-react-lite';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
// A Modal is a window of its own on Android: swipes inside it need their own gesture root.
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { VaultView } from '@frozik/vault-app/document/application/VaultView';
import type { TVaultSection } from '@frozik/vault-app/navigation/vault-pages';

import { GAP, GUTTER, RADIUS, TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { SwipeAction } from '../kit/SwipeAction';
import { useSettingsTexts, useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { blockOf, SECTION_BLOCKS } from './section-blocks';
import { sectionLabelOf } from './section-label';
import { SectionIcon } from './SectionIcon';

/** The sections, the security finds and the labels in a sheet from the bottom, each with its mark; picking one closes it. */
export const SectionSheet = observer(function SectionSheet({
  view,
  open,
  onPick,
  onClose,
  onEditLabel,
}: {
  readonly view: VaultView;
  readonly open: boolean;
  readonly onPick: (section: TVaultSection) => void;
  readonly onClose: () => void;
  /** A label swiped left offers its editor; absent where the vault cannot be changed. */
  readonly onEditLabel?: (groupId: TGroupId) => void;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const t = useVaultTexts();
  const settingsTexts = useSettingsTexts().labels;
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.phone.close}
        onPress={onClose}
        style={[styles.scrim, { backgroundColor: palette.scrim }]}
      />
      <GestureHandlerRootView
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
          {SECTION_BLOCKS.map(block => {
            const entries = view.sections.filter(entry => blockOf(entry) === block);
            if (entries.length === 0) {
              return null;
            }
            return (
              <View key={block} testID={`section-block-${block}`} style={styles.block}>
                <Text style={[styles.blockTitle, { color: palette.fgFaint }]}>
                  {t.phone.sectionBlocks[block]}
                </Text>
                {entries.map(entry => {
                  const current = view.section === entry.section;
                  const row = (
                    <Pressable
                      key={entry.section}
                      testID={`section-${entry.section}`}
                      accessibilityRole="link"
                      accessibilityState={{ selected: current }}
                      onPress={() => onPick(entry.section)}
                      style={[
                        styles.entry,
                        { backgroundColor: current ? palette.bgCard : palette.bgElevated },
                      ]}
                    >
                      <SectionIcon entry={entry} />
                      <Text numberOfLines={1} style={[styles.label, { color: palette.fg }]}>
                        {sectionLabelOf(t, entry)}
                      </Text>
                      <Text style={[styles.count, { color: palette.fgFaint }]}>{entry.count}</Text>
                    </Pressable>
                  );
                  if (entry.kind !== 'group' || isNil(onEditLabel)) {
                    return row;
                  }
                  const groupId = entry.section;
                  return (
                    <SwipeAction
                      key={entry.section}
                      end={{
                        icon: Pencil,
                        label: settingsTexts.edit(entry.name),
                        tone: 'accent',
                        testID: 'section-swipe-edit',
                        onPress: () => onEditLabel(groupId),
                      }}
                    >
                      {row}
                    </SwipeAction>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      </GestureHandlerRootView>
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
    gap: GAP,
    paddingHorizontal: GUTTER,
  },
  block: { paddingTop: 8 },
  blockTitle: {
    fontSize: TEXT_SIZE.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: GUTTER,
    paddingVertical: 4,
  },
  label: { flex: 1, fontSize: TEXT_SIZE.body },
  count: { fontSize: TEXT_SIZE.small },
});
