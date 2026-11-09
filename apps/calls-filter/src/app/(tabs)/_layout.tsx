import { Tabs } from 'expo-router';
import { List, PhoneIncoming, Settings } from 'lucide-react-native';
import type { ColorValue } from 'react-native';

import { useTexts } from '../../texts/use-texts';
import { usePalette } from '../../ui/theme/AppTheme';

interface ITabIcon {
  readonly color: ColorValue;
  readonly size: number;
}

function GroupsIcon({ color, size }: ITabIcon) {
  return <List color={color} size={size} />;
}

function CallsIcon({ color, size }: ITabIcon) {
  return <PhoneIncoming color={color} size={size} />;
}

function SettingsIcon({ color, size }: ITabIcon) {
  return <Settings color={color} size={size} />;
}

export default function TabsLayout() {
  const texts = useTexts();
  const palette = usePalette();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.fgDim,
        tabBarStyle: { backgroundColor: palette.bgElevated, borderTopColor: palette.lineSoft },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: texts.tabs.groups,
          tabBarIcon: GroupsIcon,
          tabBarButtonTestID: 'tab-groups',
        }}
      />
      <Tabs.Screen
        name="calls"
        options={{
          title: texts.tabs.calls,
          tabBarIcon: CallsIcon,
          tabBarButtonTestID: 'tab-calls',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: texts.tabs.settings,
          tabBarIcon: SettingsIcon,
          tabBarButtonTestID: 'tab-settings',
        }}
      />
    </Tabs>
  );
}
