import type { IVaultKeys } from '@frozik/vault/format/vault-keys';

import type { IDeviceSettings } from '../../device/domain/device-settings';
import type { TTransact } from '../../document/application/transact';
import type {
  IOpenedSession,
  IVaultSessionServices,
} from '../../session/application/vault-session-inputs';
import { VaultBackups } from './VaultBackups';

/** What the session's backups read of it. */
interface IBackupsSession {
  readonly keys: { readonly current: IVaultKeys };
  readonly deviceSettings: { readonly settings: IDeviceSettings };
  readonly transact: TTransact;
}

/** The session's backups on this device: opened with its current key, as many as its settings keep. */
export function createSessionBackups(
  session: IBackupsSession,
  {
    services,
    opened,
    signal,
  }: {
    readonly services: IVaultSessionServices;
    readonly opened: IOpenedSession;
    readonly signal: AbortSignal;
  }
): VaultBackups {
  return new VaultBackups({
    vaultKey: opened.vaultKey,
    snapshots: services.snapshots,
    localCopy: services.localCopyOf(opened.vaultKey),
    open: (file, openSignal) => {
      const { dek, keyId } = session.keys.current;
      return services.codec.open(file, { kind: 'session', dek, keyId }, openSignal);
    },
    clock: services.clock,
    keep: () => session.deviceSettings.settings.backupsKept,
    transact: edit => session.transact(edit),
    signal,
  });
}
