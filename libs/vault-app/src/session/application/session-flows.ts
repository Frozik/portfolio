import type { TTranslate } from '@frozik/vault/model/card-edits';
import type { IVaultDocument } from '@frozik/vault/model/vault-document';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import type { ISyncState } from '@frozik/vault/sync/sync-state';
import { isNil } from 'lodash-es';

import type { DeviceSettingsModel } from '../../device/application/DeviceSettingsModel';
import type { TTransact } from '../../document/application/transact';
import type { VaultFiles } from '../../document/application/VaultFiles';

import { VaultBackupFile } from '../../interchange/application/VaultBackupFile';
import { VaultExport } from '../../interchange/application/VaultExport';
import { VaultImport } from '../../interchange/application/VaultImport';
import { DeviceUnlockSetup } from '../../keys/application/DeviceUnlockSetup';
import { PasskeyFlow } from '../../keys/application/PasskeyFlow';
import { QuickUnlockSetup } from '../../keys/application/QuickUnlockSetup';
import { RecoveryKeyFlow } from '../../keys/application/RecoveryKeyFlow';
import type { SessionKeys } from '../../keys/application/SessionKeys';
import type { TRenderEmergencyKit } from '../../keys/domain/ports/emergency-kit';
import { LOCAL_COPY_PATH } from '../../sync/domain/local-copy';
import type { IVaultFlowServices } from './VaultFlows';

/** What the flows read of the open session. */
interface IFlowSession {
  readonly vaultKey: TVaultKey;
  readonly document: IVaultDocument;
  readonly transact: TTransact;
  readonly files: VaultFiles;
  readonly keys: SessionKeys;
  readonly deviceSettings: DeviceSettingsModel;
  /** This device's copy of the file: whether every edit is written to it. */
  readonly local: { readonly state: ISyncState };
}

/** The flows a screen opens over the open vault and drops when it closes. */
export interface ISessionFlows {
  importInto(translate: TTranslate): VaultImport;
  exportOf(): VaultExport;
  backupFileOf(): VaultBackupFile;
  recoveryKeyOf(renderKit: TRenderEmergencyKit): RecoveryKeyFlow;
  passkeysOf(): PasskeyFlow;
  quickUnlockOf(): QuickUnlockSetup;
  /** `null` where the platform has no biometric unlock. */
  deviceUnlockOf(): DeviceUnlockSetup | null;
}

export function createSessionFlows(
  services: IVaultFlowServices,
  session: IFlowSession
): ISessionFlows {
  return {
    importInto: translate =>
      new VaultImport({
        document: () => session.document,
        transact: session.transact,
        codec: services.codec,
        random: services.random,
        translate,
        readQrCode: services.readQrCode,
        readKdbx: services.readKdbx,
        storeBlob: session.files.store,
      }),
    exportOf: () =>
      new VaultExport({
        document: () => session.document,
        codec: services.codec,
        checkPassword: session.keys.check,
        saveFile: services.saveFile,
        now: services.clock.now,
        createdBy: services.identity.createdBy,
        readFiles: session.files.readAll,
        readSealedBlobs: session.files.readAllSealed,
        cxfExporter: { ...services.identity.exporter, accountId: session.vaultKey },
      }),
    backupFileOf: () =>
      new VaultBackupFile({
        settled: () => {
          const { phase, context } = session.local.state;
          return phase.kind === 'idle' && !context.pending;
        },
        readLocalFile: signal =>
          services.localCopyOf(session.vaultKey).read(LOCAL_COPY_PATH, signal),
        saveFile: services.saveFile,
        vaultName: () => session.document.settings.name,
        now: services.clock.now,
        hasBigFiles: () =>
          [...session.document.assets.values()].some(asset => asset.storage.kind === 'blob'),
      }),
    recoveryKeyOf: renderKit =>
      new RecoveryKeyFlow({
        keys: session.keys,
        random: services.random,
        renderKit,
        saveFile: services.saveFile,
      }),
    deviceUnlockOf: () =>
      isNil(services.deviceUnlock)
        ? null
        : new DeviceUnlockSetup(
            services.deviceUnlock,
            session.vaultKey,
            () => session.keys.current
          ),
    quickUnlockOf: () => {
      const { quickKeep } = services;
      return new QuickUnlockSetup({
        check: session.keys.check,
        settings: session.deviceSettings,
        keep: isNil(quickKeep)
          ? null
          : (password, setting) =>
              quickKeep.arm(
                session.vaultKey,
                session.keys.current,
                password,
                setting,
                services.clock.now()
              ),
      });
    },
    passkeysOf: () =>
      new PasskeyFlow({
        keys: session.keys,
        passkeys: services.passkeys,
        vaultKey: session.vaultKey,
        vaultName: () => session.document.settings.name,
      }),
  };
}
