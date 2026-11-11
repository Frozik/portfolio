import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CountBadge } from '../kit/CountBadge';
import { TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

export type TBottomTab = 'vault' | 'audit' | 'settings';

type TTabFace = 'sections' | TBottomTab;

const ICONS: Readonly<Record<TTabFace, ComponentProps<typeof MaterialIcons>['name']>> = {
  vault: 'vpn-key',
  sections: 'menu',
  audit: 'verified-user',
  settings: 'settings',
};
const TABS: readonly TBottomTab[] = ['vault', 'audit', 'settings'];
const ICON_SIZE = 22;
const BADGE_OFFSET = 6;

/**
 * The phone's way around an open vault, above the gesture bar; a tab may carry a count in a red badge.
 * Vault, once on the list, turns into Sections: the same thumb opens the sections sheet.
 */
export function BottomTabs({
  current,
  counts,
  onSelect,
}: {
  readonly current: TBottomTab | null;
  /** Shown only above zero. */
  readonly counts: Readonly<Partial<Record<TBottomTab, number>>>;
  readonly onSelect: (tab: TBottomTab) => void;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const t = useVaultTexts();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t.sidebar.label}
      style={[
        styles.bar,
        {
          borderTopColor: palette.line,
          backgroundColor: palette.bgElevated,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {TABS.map(tab => {
        const selected = current === tab;
        const color = selected ? palette.accent : palette.fgDim;
        const count = counts[tab] ?? 0;
        const face: TTabFace = selected && tab === 'vault' ? 'sections' : tab;
        return (
          <Pressable
            key={tab}
            testID={`tab-${tab}`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onSelect(tab)}
            style={styles.tab}
          >
            <View>
              <MaterialIcons name={ICONS[face]} size={ICON_SIZE} color={color} />
              {count > 0 && (
                <View style={styles.badge}>
                  <CountBadge count={count} testID={`tab-${tab}-count`} />
                </View>
              )}
            </View>
            <Text style={[styles.label, { color }]}>{t.phone.tabs[face]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A tab's height above the system's own inset; what floats over the page keeps clear of it. */
export const TAB_BAR_HEIGHT = TOUCH_SIZE + 8;

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: 1 },
  tab: {
    flex: 1,
    minHeight: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: { fontSize: TEXT_SIZE.caption },
  badge: { position: 'absolute', top: -BADGE_OFFSET, left: ICON_SIZE - BADGE_OFFSET },
});
