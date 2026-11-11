import type { IStorageProvider } from '@frozik/cloud-storage/core/storage-provider';
import { createSqlProvider } from '@frozik/cloud-storage/sql/sql-provider';
import type { Milliseconds } from '@frozik/utils/date/types';
import type { Language } from '@frozik/utils/i18n/language';
import { createInThreadCodec } from '@frozik/vault/codec/in-thread-codec';
import { WEB_RANDOM } from '@frozik/vault/crypto/web-random';
import { createSqlDeviceStores } from '@frozik/vault/persistence/sql/device-stores';
import { forgetVaultOnDevice } from '@frozik/vault/session/forget-vault';
import { openDatabaseSync } from 'expo-sqlite';

import { createInThreadStrengthMeter } from '@frozik/vault-app/audit/application/strength-estimate';
import type { TFollowIncomingFiles } from '@frozik/vault-app/cloud/domain/ports/vault-file-picker';
import { noteDiagnostics } from '@frozik/vault-app/diagnostics/application/diagnostics-recorder';
import { DiagnosticsModel } from '@frozik/vault-app/diagnostics/application/DiagnosticsModel';
import type { IDiagnosticsJournal } from '@frozik/vault-app/diagnostics/domain/ports/diagnostics-journal';
import { createBiometricDeviceUnlock } from '@frozik/vault-app/keys/application/biometric-device-unlock';
import { UpdateWatch } from '@frozik/vault-app/release/application/UpdateWatch';
import { createMemoryKeyCustody } from '@frozik/vault-app/session/application/memory-key-custody';
import { createQuickKeep } from '@frozik/vault-app/session/application/quick-keep';
import { SYSTEM_SESSION_CLOCK } from '@frozik/vault-app/session/application/system-session-clock';
import { VaultApp } from '@frozik/vault-app/session/application/VaultApp';
import { createWebCryptoQuickPepper } from '@frozik/vault-app/session/application/webcrypto-quick-pepper';
import { localCopyDatabase } from '@frozik/vault-app/sync/domain/local-copy';
import { createHibpBreachCheck } from '@frozik/vault-http/audit/hibp-breach-check';
import {
  memoryDirectoryCache,
  twoFactorDirectoryLoader,
} from '@frozik/vault-http/audit/two-factor-directory';
import { createCloudConnector } from '@frozik/vault-http/cloud/cloud-connection';
import { googleDriveOpener } from '@frozik/vault-http/cloud/google-drive';
import { probeWebDavServer } from '@frozik/vault-http/cloud/webdav-prober';
import { PHONE_ICON_SEARCH, siteIconFetcher } from '@frozik/vault-http/document/site-icon-fetcher';
import { createVersionJsonSource } from '@frozik/vault-http/release/version-json-source';

import type { INativeLockSignals } from './infrastructure/app-state-lock-signals';
import { pickVaultFileFromDocuments } from './infrastructure/document-picker';
import { expoSqlDriver } from './infrastructure/expo-sql-driver';
import { googleDriveSignIn } from './infrastructure/google-drive-sign-in';
import { followIncomingFiles } from './infrastructure/incoming-files';
import { readKdbxOnPhone } from './infrastructure/kdbx-reader';
import { QUICK_CRYPTO_KDF } from './infrastructure/kdf-quick-crypto';
import { mlKitReadQrCode } from './infrastructure/ml-kit-qr-reader';
import { NATIVE_CLIPBOARD } from './infrastructure/native-clipboard';
import { NATIVE_THEME_STORE } from './infrastructure/native-theme-store';
import { KEEP_IMAGES_AS_THEY_ARE, NO_PASSKEYS } from './infrastructure/not-on-this-phone';
import { phoneBackupFolder } from './infrastructure/phone-backup-folder';
import { pickedFolderSaveFile } from './infrastructure/picked-folder-file-saver';
import { RUNTIME_RELOAD_WIPE } from './infrastructure/runtime-reload-wipe';
import { SECURE_STORE_BIOMETRIC_SECRETS } from './infrastructure/secure-store-biometric-secrets';
import { SECURE_STORE_QUICK_KEEP } from './infrastructure/secure-store-quick-keep';
import { shareSheetSaveFile } from './infrastructure/share-sheet-file-saver';
import { openLoneTabChannel, SOLE_LEADERSHIP } from './infrastructure/single-process';
import { fitSiteIconOnPhone } from './infrastructure/site-icon-pictures';
import { sqliteDiagnosticsJournal } from './infrastructure/sqlite-diagnostics-journal';

/** The app's database file: the device stores and every vault's local copy. */
const DATABASE_NAME = 'ciphra-vault.db';
const DIAGNOSTICS_DATABASE_NAME = 'ciphra-diagnostics.db';
const PRODUCT_NAME = 'Ciphra Vault';
/** The site the web app runs on: passkeys and exports name it. */
const SITE = 'ciphra-vault.github.io';
const VERSION_MANIFEST_URL = `https://${SITE}/version.json`;
/** The maker a new vault's manifest names. */
const CREATED_BY = 'ciphra android';

/** The composition root: SQLite, quick-crypto and the phone's services are wired here and nowhere else. */
/** Files other apps hand over, each taken in as a vault file. */
export const INCOMING_FILES: TFollowIncomingFiles = followIncomingFiles;

/** A card's file saved into a picked folder or handed to another app. */
export const FILE_SAVERS = { saveToFolder: pickedFolderSaveFile, share: shareSheetSaveFile };

export function createDiagnosticsJournal(): IDiagnosticsJournal {
  return sqliteDiagnosticsJournal(() => openDatabaseSync(DIAGNOSTICS_DATABASE_NAME));
}

/** The diagnostics page's model over the phone's log; made at start, it drops what outlived the term. */
export function createDiagnostics(diagnostics: IDiagnosticsJournal): DiagnosticsModel {
  return new DiagnosticsModel(diagnostics, SYSTEM_SESSION_CLOCK);
}

export function createVaultApp(
  language: Language,
  lock: INativeLockSignals,
  diagnostics: IDiagnosticsJournal
): VaultApp {
  const driver = expoSqlDriver(openDatabaseSync(DATABASE_NAME));
  const deviceStores = createSqlDeviceStores(driver, WEB_RANDOM);
  const localCopies = new Map<string, IStorageProvider>();
  const openGoogleDrive = googleDriveOpener(
    googleDriveSignIn(note => noteDiagnostics({ diagnostics, clock: SYSTEM_SESSION_CLOCK }, note))
  );
  const createStrengthMeter = () => createInThreadStrengthMeter(language);
  return new VaultApp({
    codec: createInThreadCodec({
      argon2: QUICK_CRYPTO_KDF,
      random: WEB_RANDOM,
      elapsed: () => performance.now() as Milliseconds,
    }),
    disposeCodec: () => undefined,
    forgetOnDevice: vaultKey => forgetVaultOnDevice(deviceStores, vaultKey),
    createStrengthMeter,
    probeWebDav: probeWebDavServer,
    pickVaultFile: pickVaultFileFromDocuments,
    openGoogleDrive,
    connectCloud: createCloudConnector(openGoogleDrive),
    acquireLeadership: SOLE_LEADERSHIP,
    registry: deviceStores.registry,
    syncState: deviceStores.syncState,
    drafts: deviceStores.drafts,
    deviceConfig: deviceStores.deviceConfig,
    usage: deviceStores.usage,
    snapshots: deviceStores.snapshots,
    compressor: KEEP_IMAGES_AS_THEY_ARE,
    localCopyOf: vaultKey => {
      const provider =
        localCopies.get(vaultKey) ??
        createSqlProvider({ driver, namespace: localCopyDatabase(vaultKey) });
      localCopies.set(vaultKey, provider);
      return provider;
    },
    random: WEB_RANDOM,
    clock: SYSTEM_SESSION_CLOCK,
    signals: lock.signals,
    clipboard: NATIVE_CLIPBOARD,
    openTabChannel: openLoneTabChannel,
    wipe: RUNTIME_RELOAD_WIPE,
    custody: createMemoryKeyCustody(WEB_RANDOM),
    pepper: createWebCryptoQuickPepper(),
    quickKeep: createQuickKeep(SECURE_STORE_QUICK_KEEP, QUICK_CRYPTO_KDF, WEB_RANDOM),
    deviceUnlock: createBiometricDeviceUnlock(SECURE_STORE_BIOMETRIC_SECRETS, QUICK_CRYPTO_KDF),
    themeStore: NATIVE_THEME_STORE,
    saveFile: shareSheetSaveFile,
    identity: { createdBy: CREATED_BY, exporter: { rpId: SITE, displayName: PRODUCT_NAME } },
    demo: null,
    passkeys: NO_PASSKEYS,
    readQrCode: mlKitReadQrCode,
    diagnostics,
    backupFolder: phoneBackupFolder(),
    fetchSiteIcon: siteIconFetcher(fitSiteIconOnPhone, PHONE_ICON_SEARCH),
    readKdbx: readKdbxOnPhone,
    auditSources: {
      meter: createStrengthMeter,
      breaches: createHibpBreachCheck(),
      loadTwoFactorDirectory: twoFactorDirectoryLoader(memoryDirectoryCache()),
    },
  });
}

export function createUpdateWatch(version: string): UpdateWatch {
  return new UpdateWatch(createVersionJsonSource(VERSION_MANIFEST_URL), {
    client: 'android',
    version,
  });
}
