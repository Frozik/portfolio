import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

export type TBottomTab = 'vault' | 'search' | 'audit' | 'settings';

const ICONS: Readonly<Record<TBottomTab, ComponentProps<typeof MaterialIcons>['name']>> = {
  vault: 'vpn-key',
  search: 'search',
  audit: 'verified-user',
  settings: 'settings',
};
const TABS: readonly TBottomTab[] = ['vault', 'search', 'audit', 'settings'];
const ICON_SIZE = 22;

/** The phone's way around an open vault, above the gesture bar. */
export function BottomTabs({
  current,
  onSelect,
}: {
  readonly current: TBottomTab | null;
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
        return (
          <Pressable
            key={tab}
            testID={`tab-${tab}`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onSelect(tab)}
            style={styles.tab}
          >
            <MaterialIcons name={ICONS[tab]} size={ICON_SIZE} color={color} />
            <Text style={[styles.label, { color }]}>{t.phone.tabs[tab]}</Text>
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
});
