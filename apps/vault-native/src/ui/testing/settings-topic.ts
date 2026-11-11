import { fireEvent, screen } from 'expo-router/testing-library';

import type { TSettingsTopic } from '../settings/settings-topics';

/** The Settings tab, then one of its topics, as a thumb gets there. */
export async function openSettingsTopic(topic: TSettingsTopic): Promise<void> {
  await fireEvent.press(screen.getByTestId('tab-settings'));
  await fireEvent.press(await screen.findByTestId(`settings-topic-${topic}`));
  await screen.findByTestId(`settings-${topic}`);
}
