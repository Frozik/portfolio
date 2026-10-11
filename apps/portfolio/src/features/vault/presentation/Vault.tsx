import type { IStorageProvider } from '@frozik/cloud-storage/core/storage-provider';
import { createIndexedDbProvider } from '@frozik/cloud-storage/indexeddb/indexeddb-provider';
import { cn } from '@frozik/components/components/cn';
import { WEB_RANDOM } from '@frozik/vault/crypto/web-random';
import { createIndexedDbDeviceStores } from '@frozik/vault/persistence/indexeddb/device-stores';
import { forgetVaultOnDevice } from '@frozik/vault/session/forget-vault';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

import { getCurrentLanguage } from '../../../shared/i18n/locale';
import { useVaultStore } from '../application/useVaultStore';
import { VaultFeatureStore } from '../application/VaultFeatureStore';
import { localCopyDatabase } from '../domain/local-copy';
import { openBroadcastTabChannel } from '../infrastructure/broadcast-tab-channel';
import {
  BROWSER_CLIPBOARD,
  resumePendingClipboardClear,
} from '../infrastructure/browser-clipboard';
import {
  BROWSER_PAGE_SIGNALS,
  BROWSER_SESSION_CLOCK,
} from '../infrastructure/browser-page-signals';
import { CANVAS_IMAGE_COMPRESSOR } from '../infrastructure/canvas-image-compressor';
import { connectCloud } from '../infrastructure/cloud-connection';
import { saveFile } from '../infrastructure/file-saver';
import { openGoogleDrive } from '../infrastructure/google-drive';
import { createHibpBreachCheck } from '../infrastructure/hibp-breach-check';
import { readKdbxInWorker } from '../infrastructure/kdbx-reader-client';
import { reloadPage } from '../infrastructure/page-reload';
import { readQrCode } from '../infrastructure/qr-reader';
import { fetchSiteIcon } from '../infrastructure/site-icon-source';
import { createStrengthMeterClient } from '../infrastructure/strength-meter-client';
import { loadTwoFactorDirectory } from '../infrastructure/two-factor-directory';
import { createVaultCodecWorkerClient } from '../infrastructure/vault-codec-worker-client';
import { acquireWebLockLeadership } from '../infrastructure/web-lock-leadership';
import { WEBAUTHN_PASSKEYS } from '../infrastructure/webauthn-passkeys';
import { probeWebDavServer } from '../infrastructure/webdav-prober';
import { VaultIntro } from './VaultIntro';

/** The name a CXF export gives its maker. */
const VAULT_EXPORTER_NAME = 'Password vault';

/** The composition root: the device stores, the codec Worker and the browser are wired here and nowhere else. */
function createStore(): VaultFeatureStore {
  const deviceStores = createIndexedDbDeviceStores(WEB_RANDOM);
  const codec = createVaultCodecWorkerClient();
  const localCopies = new Map<string, IStorageProvider>();
  return new VaultFeatureStore({
    codec,
    disposeCodec: codec.dispose,
    forgetOnDevice: vaultKey => forgetVaultOnDevice(deviceStores, vaultKey),
    createStrengthMeter: () => createStrengthMeterClient(getCurrentLanguage()),
    probeWebDav: probeWebDavServer,
    openGoogleDrive,
    connectCloud,
    acquireLeadership: acquireWebLockLeadership,
    registry: deviceStores.registry,
    syncState: deviceStores.syncState,
    drafts: deviceStores.drafts,
    deviceConfig: deviceStores.deviceConfig,
    snapshots: deviceStores.snapshots,
    compressor: CANVAS_IMAGE_COMPRESSOR,
    localCopyOf: vaultKey => {
      const provider =
        localCopies.get(vaultKey) ?? createIndexedDbProvider(localCopyDatabase(vaultKey));
      localCopies.set(vaultKey, provider);
      return provider;
    },
    random: WEB_RANDOM,
    clock: BROWSER_SESSION_CLOCK,
    page: BROWSER_PAGE_SIGNALS,
    clipboard: BROWSER_CLIPBOARD,
    openTabChannel: openBroadcastTabChannel,
    reload: reloadPage,
    saveFile,
    exporter: { rpId: window.location.hostname, displayName: VAULT_EXPORTER_NAME },
    passkeys: WEBAUTHN_PASSKEYS,
    readQrCode,
    fetchSiteIcon,
    readKdbx: readKdbxInWorker,
    auditSources: {
      meter: () => createStrengthMeterClient(getCurrentLanguage()),
      breaches: createHibpBreachCheck(),
      loadTwoFactorDirectory,
    },
  });
}

export const Vault = observer(() => {
  const store = useVaultStore(createStore);

  useEffect(() => {
    void store.registry.refresh();
  }, [store]);
  useEffect(resumePendingClipboardClear, []);

  const open = !isNil(store.session);
  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-[var(--container-narrow)] flex-col px-6 sm:px-8',
        open ? 'h-full py-6' : 'gap-10 pt-12 pb-24'
      )}
    >
      {!open && <VaultIntro />}
      <Outlet context={store} />
    </div>
  );
});
