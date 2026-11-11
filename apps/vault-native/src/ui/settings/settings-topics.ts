import type MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';

import { createVaultPaths } from '@frozik/vault-app/navigation/vault-paths';

/** The settings' topics, as Android lays them out: a list to fall into, one page each. */
export const SETTINGS_TOPICS = [
  'security',
  'display',
  'labels',
  'vault',
  'cloud',
  'data',
  'backup',
  'diagnostics',
  'about',
] as const;

export type TSettingsTopic = (typeof SETTINGS_TOPICS)[number];

export const TOPIC_ICONS: Readonly<
  Record<TSettingsTopic, ComponentProps<typeof MaterialIcons>['name']>
> = {
  security: 'security',
  display: 'palette',
  labels: 'label-outline',
  vault: 'vpn-key',
  cloud: 'cloud-queue',
  data: 'import-export',
  backup: 'backup',
  diagnostics: 'bug-report',
  about: 'info-outline',
};

const paths = createVaultPaths('');

export function settingsTopicPath(vaultKey: string, topic: TSettingsTopic): string {
  return `${paths.settings(vaultKey)}/${topic}`;
}

export function settingsTopicOf(value: string | undefined): TSettingsTopic | null {
  return SETTINGS_TOPICS.find(topic => topic === value) ?? null;
}
