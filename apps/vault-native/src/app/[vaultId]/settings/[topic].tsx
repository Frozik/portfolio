import { useLocalSearchParams } from 'expo-router';
import { isNil } from 'lodash-es';

import { settingsTopicOf } from '../../../ui/settings/settings-topics';
import { SettingsTopicScreen } from '../../../ui/settings/SettingsTopicScreen';
import { PageNotFound } from '../../../ui/vault/PageNotFound';

export default function SettingsTopic() {
  const { topic } = useLocalSearchParams<{ topic: string }>();
  const known = settingsTopicOf(topic);
  return isNil(known) ? <PageNotFound /> : <SettingsTopicScreen topic={known} />;
}
