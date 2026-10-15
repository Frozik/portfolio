import type { IVaultDocument } from '@frozik/vault/model/vault-document';

import type { DeviceSettingsModel } from '../../device/application/DeviceSettingsModel';
import { createDeviceSettings } from '../../device/application/DeviceSettingsModel';
import type { RecentCards } from '../../document/application/RecentCards';
import { createRecentCards } from '../../document/application/RecentCards';
import type { IOpenedSession, IVaultSessionServices } from './vault-session-inputs';

/** What this device keeps of the open vault, sealed under its key: the settings, the cards opened lately. */
export function createDeviceRecords(
  services: Pick<IVaultSessionServices, 'deviceConfig' | 'usage' | 'random'>,
  opened: Pick<IOpenedSession, 'vaultKey' | 'keys'>,
  document: () => IVaultDocument
): { readonly deviceSettings: DeviceSettingsModel; readonly recent: RecentCards } {
  const sealedUnder = { vaultKey: opened.vaultKey, dek: opened.keys.dek, random: services.random };
  return {
    deviceSettings: createDeviceSettings({ ...sealedUnder, store: services.deviceConfig }),
    recent: createRecentCards({ ...sealedUnder, store: services.usage, document }),
  };
}
