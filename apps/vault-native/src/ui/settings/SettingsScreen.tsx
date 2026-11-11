import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { observer } from 'mobx-react-lite';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GAP, GUTTER, TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { useSettingsTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { useSession } from '../vault/session-context';
import { SETTINGS_TOPICS, settingsTopicPath, TOPIC_ICONS } from './settings-topics';

const ICON_SIZE = 24;
const CHEVRON_SIZE = 22;
/** A topic row holds its name and a line of what is inside. */
const ROW_HEIGHT = 72;

/** The settings as Android lays them out: one row per topic, each falling into its own page. */
export const SettingsScreen = observer(function SettingsScreen() {
  const session = useSession();
  const router = useRouter();
  const palette = usePalette();
  const t = useSettingsTexts().topics;
  return (
    <ScrollView testID="settings" contentContainerStyle={styles.page}>
      {SETTINGS_TOPICS.map(topic => (
        <Pressable
          key={topic}
          testID={`settings-topic-${topic}`}
          accessibilityRole="link"
          accessibilityHint={t[topic].hint}
          onPress={() => router.push(settingsTopicPath(session.vaultKey, topic))}
          style={({ pressed }) => [
            styles.row,
            { borderBottomColor: palette.lineSoft },
            pressed && { backgroundColor: palette.bgElevated },
          ]}
        >
          <MaterialIcons name={TOPIC_ICONS[topic]} size={ICON_SIZE} color={palette.accent} />
          <View style={styles.text}>
            <Text style={[styles.title, { color: palette.fg }]}>{t[topic].title}</Text>
            <Text numberOfLines={1} style={[styles.hint, { color: palette.fgFaint }]}>
              {t[topic].hint}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={CHEVRON_SIZE} color={palette.fgFaint} />
        </Pressable>
      ))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  page: { paddingVertical: 8 },
  row: {
    minHeight: Math.max(ROW_HEIGHT, TOUCH_SIZE),
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP + 4,
    paddingHorizontal: GUTTER,
    borderBottomWidth: 1,
  },
  text: { flex: 1, gap: 2 },
  title: { fontSize: TEXT_SIZE.body, fontWeight: '500' },
  hint: { fontSize: TEXT_SIZE.small },
});
