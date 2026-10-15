import type { IStorageProvider } from '@frozik/cloud-storage/core/storage-provider';
import { createIndexedDbProvider } from '@frozik/cloud-storage/indexeddb/indexeddb-provider';
import { cn } from '@frozik/components/components/cn';
import { PortalContainerContext } from '@frozik/components/ui/portal-container';
import { WEB_RANDOM } from '@frozik/vault/crypto/web-random';
import { createIndexedDbDeviceStores } from '@frozik/vault/persistence/indexeddb/device-stores';
import { forgetVaultOnDevice } from '@frozik/vault/session/forget-vault';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';

import { pageLanguage } from '@frozik/utils/i18n/page-language';
import { createDemoSeed } from '@frozik/vault-app/document/application/demo-seed';
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
import {
  BROWSER_CLIPBOARD,
  resumePendingClipboardClear,
} from '@frozik/vault-browser/exposure/browser-clipboard';
import { saveFile } from '@frozik/vault-browser/interchange/file-saver';
import { readKdbxInWorker } from '@frozik/vault-browser/interchange/kdbx-reader-client';
import { WEBAUTHN_PASSKEYS } from '@frozik/vault-browser/keys/webauthn-passkeys';
import { openBroadcastTabChannel } from '@frozik/vault-browser/session/broadcast-tab-channel';
import { BROWSER_LOCK_SIGNALS } from '@frozik/vault-browser/session/browser-lock-signals';
import { PAGE_RELOAD_WIPE } from '@frozik/vault-browser/session/page-reload-wipe';
import { acquireWebLockLeadership } from '@frozik/vault-browser/session/web-lock-leadership';
import { createHibpBreachCheck } from '@frozik/vault-http/audit/hibp-breach-check';
import { createCloudConnector } from '@frozik/vault-http/cloud/cloud-connection';
import { probeWebDavServer } from '@frozik/vault-http/cloud/webdav-prober';
import { ThemeMenu } from '@frozik/vault-react/appearance/ThemeMenu';
import { vaultT } from '@frozik/vault-react/texts/vault';
import { useVaultStore } from './useVaultStore';
import { VaultIntro } from './VaultIntro';

/** The vault's own OAuth client: sign-in elsewhere on the site never asks for Drive. */
const GOOGLE_VAULT_CLIENT_ID = import.meta.env.VITE_GOOGLE_VAULT_CLIENT_ID ?? '';

/** Where this browser keeps the vault's theme choice. */
const THEME_KEY = 'vault:theme';

/** The name a CXF export gives its maker. */
const VAULT_EXPORTER_NAME = 'Password vault';
/** The maker a new vault's manifest names. */
const CREATED_BY = 'portfolio web';

/** The composition root: the device stores, the codec Worker and the browser are wired here and nowhere else. */
function createStore(): VaultApp {
  const openGoogleDrive = createGoogleDriveOpener(GOOGLE_VAULT_CLIENT_ID);
  const deviceStores = createIndexedDbDeviceStores(WEB_RANDOM);
  const codec = createVaultCodecWorkerClient();
  const localCopies = new Map<string, IStorageProvider>();
  return new VaultApp({
    codec,
    disposeCodec: codec.dispose,
    forgetOnDevice: vaultKey => forgetVaultOnDevice(deviceStores, vaultKey),
    createStrengthMeter: () => createStrengthMeterClient(pageLanguage()),
    probeWebDav: probeWebDavServer,
    pickVaultFile: null,
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
      exporter: { rpId: window.location.hostname, displayName: VAULT_EXPORTER_NAME },
    },
    demo: createDemoSeed({ random: WEB_RANDOM, clock: SYSTEM_SESSION_CLOCK }),
    passkeys: WEBAUTHN_PASSKEYS,
    readQrCode,
    fetchSiteIcon,
    readKdbx: readKdbxInWorker,
    auditSources: {
      meter: () => createStrengthMeterClient(pageLanguage()),
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

  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);

  const open = !isNil(store.session);
  return (
    <div
      data-theme={store.appearance.preference}
      className="flex min-h-full flex-col bg-landing-bg text-landing-fg"
    >
      <div className="pointer-events-none sticky top-3 z-10 flex h-0 justify-end pr-3">
        <ThemeMenu
          appearance={store.appearance}
          texts={vaultT.appearance}
          className="pointer-events-auto h-fit"
        />
      </div>
      <div
        className={cn(
          'mx-auto flex w-full max-w-[var(--container-narrow)] flex-col px-6 sm:px-8',
          open ? 'h-full pt-14 pb-6' : 'gap-10 pt-14 pb-24'
        )}
      >
        <PortalContainerContext value={portalContainer}>
          {!open && <VaultIntro />}
          <Outlet context={store} />
        </PortalContainerContext>
      </div>
      <div ref={setPortalContainer} />
    </div>
  );
});
