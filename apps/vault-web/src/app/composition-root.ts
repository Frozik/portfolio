import type { IStorageProvider } from '@frozik/cloud-storage/core/storage-provider';
import { createIndexedDbProvider } from '@frozik/cloud-storage/indexeddb/indexeddb-provider';
import type { Language } from '@frozik/utils/i18n/language';
import { WEB_RANDOM } from '@frozik/vault/crypto/web-random';
import { createIndexedDbDeviceStores } from '@frozik/vault/persistence/indexeddb/device-stores';
import { forgetVaultOnDevice } from '@frozik/vault/session/forget-vault';

import { UpdateWatch } from '@frozik/vault-app/release/application/UpdateWatch';
import { createMemoryKeyCustody } from '@frozik/vault-app/session/application/memory-key-custody';
import { SYSTEM_SESSION_CLOCK } from '@frozik/vault-app/session/application/system-session-clock';
import { VaultApp } from '@frozik/vault-app/session/application/VaultApp';
import { createWebCryptoQuickPepper } from '@frozik/vault-app/session/application/webcrypto-quick-pepper';
import { localCopyDatabase } from '@frozik/vault-app/sync/domain/local-copy';
import { createStrengthMeterClient } from '@frozik/vault-browser/audit/strength-meter-client';
import { loadTwoFactorDirectory } from '@frozik/vault-browser/audit/two-factor-directory';
import { createGoogleDriveOpener } from '@frozik/vault-browser/cloud/google-drive';
import { createVaultCodecWorkerClient } from '@frozik/vault-browser/codec/vault-codec-worker-client';
import { createLocalThemeStore } from '@frozik/vault-browser/device/local-theme-store';
import { CANVAS_IMAGE_COMPRESSOR } from '@frozik/vault-browser/document/canvas-image-compressor';
import { readQrCode } from '@frozik/vault-browser/document/qr-reader';
import { fetchSiteIcon } from '@frozik/vault-browser/document/site-icon-source';
import { BROWSER_CLIPBOARD } from '@frozik/vault-browser/exposure/browser-clipboard';
import { saveFile } from '@frozik/vault-browser/interchange/file-saver';
import { readKdbxInWorker } from '@frozik/vault-browser/interchange/kdbx-reader-client';
import { pickVaultFileInBrowser } from '@frozik/vault-browser/interchange/vault-file-picker';
import { WEBAUTHN_PASSKEYS } from '@frozik/vault-browser/keys/webauthn-passkeys';
import { openBroadcastTabChannel } from '@frozik/vault-browser/session/broadcast-tab-channel';
import { BROWSER_LOCK_SIGNALS } from '@frozik/vault-browser/session/browser-lock-signals';
import { PAGE_RELOAD_WIPE } from '@frozik/vault-browser/session/page-reload-wipe';
import { acquireWebLockLeadership } from '@frozik/vault-browser/session/web-lock-leadership';
import { createHibpBreachCheck } from '@frozik/vault-http/audit/hibp-breach-check';
import { createCloudConnector } from '@frozik/vault-http/cloud/cloud-connection';
import { probeWebDavServer } from '@frozik/vault-http/cloud/webdav-prober';
import { createVersionJsonSource } from '@frozik/vault-http/release/version-json-source';
import { THEME_KEY } from './theme-key';

/** The vault's own OAuth client; empty when the host declares none, and Drive is then not offered. */
const GOOGLE_VAULT_CLIENT_ID = import.meta.env.VITE_GOOGLE_VAULT_CLIENT_ID ?? '';

const PRODUCT_NAME = 'Ciphra Vault';
/** Published with every release next to the app; never cached. */
const VERSION_MANIFEST_URL = '/version.json';
/** The maker a new vault's manifest names. */
const CREATED_BY = 'ciphra web';

/** The composition root: the device stores, the codec Worker and the browser are wired here and nowhere else. */
export function createVaultApp(language: Language): VaultApp {
  const openGoogleDrive = createGoogleDriveOpener(GOOGLE_VAULT_CLIENT_ID);
  const deviceStores = createIndexedDbDeviceStores(WEB_RANDOM);
  const codec = createVaultCodecWorkerClient();
  const localCopies = new Map<string, IStorageProvider>();
  const createStrengthMeter = () => createStrengthMeterClient(language);
  return new VaultApp({
    codec,
    disposeCodec: codec.dispose,
    forgetOnDevice: vaultKey => forgetVaultOnDevice(deviceStores, vaultKey),
    createStrengthMeter,
    probeWebDav: probeWebDavServer,
    pickVaultFile: pickVaultFileInBrowser,
    openGoogleDrive,
    connectCloud: createCloudConnector(openGoogleDrive),
    acquireLeadership: acquireWebLockLeadership,
    registry: deviceStores.registry,
    syncState: deviceStores.syncState,
    drafts: deviceStores.drafts,
    deviceConfig: deviceStores.deviceConfig,
    usage: deviceStores.usage,
    snapshots: deviceStores.snapshots,
    compressor: CANVAS_IMAGE_COMPRESSOR,
    localCopyOf: vaultKey => {
      const provider =
        localCopies.get(vaultKey) ?? createIndexedDbProvider(localCopyDatabase(vaultKey));
      localCopies.set(vaultKey, provider);
      return provider;
    },
    random: WEB_RANDOM,
    clock: SYSTEM_SESSION_CLOCK,
    signals: BROWSER_LOCK_SIGNALS,
    clipboard: BROWSER_CLIPBOARD,
    openTabChannel: openBroadcastTabChannel,
    wipe: PAGE_RELOAD_WIPE,
    custody: createMemoryKeyCustody(WEB_RANDOM),
    pepper: createWebCryptoQuickPepper(),
    deviceUnlock: null,
    themeStore: createLocalThemeStore(THEME_KEY),
    saveFile,
    identity: {
      createdBy: CREATED_BY,
      exporter: { rpId: window.location.hostname, displayName: PRODUCT_NAME },
    },
    demo: null,
    passkeys: WEBAUTHN_PASSKEYS,
    readQrCode,
    fetchSiteIcon,
    readKdbx: readKdbxInWorker,
    auditSources: {
      meter: createStrengthMeter,
      breaches: createHibpBreachCheck(),
      loadTwoFactorDirectory,
    },
  });
}

export function createUpdateWatch(): UpdateWatch {
  return new UpdateWatch(createVersionJsonSource(VERSION_MANIFEST_URL), {
    client: 'web',
    version: __APP_VERSION__,
  });
}
