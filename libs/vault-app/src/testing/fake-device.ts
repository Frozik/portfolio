import { storagePath } from '@frozik/cloud-storage/core/storage-path';
import { createMemoryProvider } from '@frozik/cloud-storage/memory/memory-provider';
import type { Milliseconds } from '@frozik/utils/date/types';
import { err, ok } from '@frozik/utils/result/result';
import { createInThreadCodec } from '@frozik/vault/codec/in-thread-codec';
import { toHex } from '@frozik/vault/crypto/bytes';
import { isVaultFile } from '@frozik/vault/format/cloud-file-names';
import type { IImportBatch } from '@frozik/vault/import/imported-card';
import { fill, plainCard, templateTabs } from '@frozik/vault/import/template-card';
import { INTERNET_ACCOUNT_TEMPLATE } from '@frozik/vault/model/templates/internet-account';
import { forgetVaultOnDevice } from '@frozik/vault/session/forget-vault';
import { createFakeKdf } from '@frozik/vault/testing/fake-kdf';
import { createMemoryDevice } from '@frozik/vault/testing/memory-device-stores';
import { createSeededRandom } from '@frozik/vault/testing/seeded-random';
import { isNil } from 'lodash-es';
import { when } from 'mobx';
import { Temporal } from 'temporal-polyfill';

import type { IWebDavSecrets, TConnectCloud } from '../cloud/domain/ports/cloud';
import { createDemoSeed } from '../document/application/demo-seed';
import type { IFileToSave } from '../interchange/domain/ports/file-saver';
import type { IPasskeys } from '../keys/domain/ports/passkeys';
import { createQuickKeep } from '../session/application/quick-keep';
import { VaultApp } from '../session/application/VaultApp';
import { createWebCryptoQuickPepper } from '../session/application/webcrypto-quick-pepper';
import type { ITabChannel, TTabMessage } from '../session/domain/ports/tab-channel';
import { createFakeClipboard } from './fake-clipboard';
import { createFakeDeviceUnlock } from './fake-device-unlock';
import { createFakeKeyCustody } from './fake-key-custody';
import { createFakeLockSignals } from './fake-lock-signals';
import { createFakeProcessWipe } from './fake-process-wipe';
import { createFakeSessionClock } from './fake-session-clock';
import { createFakeThemeStore } from './fake-theme-store';
// The app loads the open session's model on the first unlock; loaded here up front, a test that
// ends right after a lock never leaves that load running past its teardown.
import '../session/application/VaultSession';

/** The fake strength meter calls a password this short weak. */
const WEAK_LENGTH = 10;

/** The device's tabs of one vault: a message posted by one reaches every other one. */
function aTabHub(): () => ITabChannel {
  const listeners = new Set<(message: TTabMessage) => void>();
  return () => {
    const own = new Set<(message: TTabMessage) => void>();
    return {
      post: message =>
        [...listeners]
          .filter(listener => !own.has(listener))
          .forEach(listener => listener(message)),
      onMessage: listener => {
        own.add(listener);
        listeners.add(listener);
        return () => {
          own.delete(listener);
          listeners.delete(listener);
        };
      },
      close: () => own.forEach(listener => listeners.delete(listener)),
    };
  };
}

/** A cloud several devices reach: one store per address, and the secrets each connection was given. */
export function aCloud() {
  const stores = new Map<string, ReturnType<typeof createMemoryProvider>>();
  const given: (IWebDavSecrets | null)[] = [];
  /** The time the cloud stamps on what is written; the real time unless a test sets one. */
  let writtenAt: Milliseconds | null = null;
  const stamp = (): Milliseconds =>
    writtenAt ?? (Temporal.Now.instant().epochMilliseconds as Milliseconds);
  const connect: TConnectCloud = (location, secrets) => {
    given.push(secrets);
    if (location.kind === 'webdav' && isNil(secrets)) {
      return null;
    }
    const address = location.kind === 'webdav' ? location.url : location.space;
    const storage = stores.get(address) ?? createMemoryProvider({ now: stamp });
    stores.set(address, storage);
    return { location, storage, googleAuth: null };
  };
  return {
    connect,
    given: () => given,
    storeAt: (address: string) => stores.get(address),
    setWrittenAt: (ms: number | null) => {
      writtenAt = ms as Milliseconds | null;
    },
  };
}

/**
 * A platform authenticator with the PRF extension: each passkey a secret, its
 * PRF the SHA-256 of secret and salt. The user may decline, or the device lack PRF.
 */
function aPasskeyAuthenticator(seed: number) {
  const random = createSeededRandom(seed + 1000);
  const secrets = new Map<string, Uint8Array<ArrayBuffer>>();
  let answer: 'yes' | 'cancel' | 'no-prf' = 'yes';
  let site = 'vault.example';
  const signalled: string[] = [];
  const prf = async (secret: Uint8Array<ArrayBuffer>, salt: Uint8Array<ArrayBuffer>) =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from([...secret, ...salt])));
  const passkeys: IPasskeys & {
    answer(next: typeof answer): void;
    moveTo(next: string): void;
    signalled(): readonly string[];
  } = {
    answer: next => {
      answer = next;
    },
    moveTo: next => {
      site = next;
    },
    signalled: () => signalled,
    rpId: () => site,
    capabilities: () => Promise.resolve({ prf: true, platform: 'passkey' as const }),
    signalUnknown: credentialId => {
      signalled.push(toHex(credentialId));
      return Promise.resolve();
    },
    async create({ salt }) {
      if (answer !== 'yes') {
        return err(answer === 'cancel' ? 'cancelled' : 'no-prf');
      }
      const credentialId = random.bytes(16);
      const secret = random.bytes(32);
      secrets.set(toHex(credentialId), secret);
      return ok({ credentialId, prfOutput: await prf(secret, salt) });
    },
    async get({ credentialIds, salt }) {
      const known = credentialIds.find(id => secrets.has(toHex(id)));
      const secret = isNil(known) ? undefined : secrets.get(toHex(known));
      if (answer !== 'yes' || isNil(known) || isNil(secret)) {
        return err('cancelled');
      }
      return ok({ credentialId: known, prfOutput: await prf(secret, salt) });
    },
  };
  return passkeys;
}

/** One device: its stores survive a store's death the way IndexedDB survives a reload. */
export function aDevice({
  cloud = aCloud(),
  seed = 7,
  siteIcons = {},
  keepsQuickLocks = false,
}: {
  readonly cloud?: ReturnType<typeof aCloud>;
  readonly seed?: number;
  /** A phone: a quick lock is kept across restarts, as its Keystore keeps it. */
  readonly keepsQuickLocks?: boolean;
  /** What the icon service answers by domain; any other domain gets no answer, so nothing changes. */
  readonly siteIcons?: Readonly<Record<string, 'icon' | 'none'>>;
} = {}) {
  const siteIconRequests: string[] = [];
  const random = createSeededRandom(seed);
  const deviceStores = createMemoryDevice()(random);
  const localCopies = new Map<string, ReturnType<typeof createMemoryProvider>>();
  let writes = 0;
  const writtenAt = () => (writes += 1) as Milliseconds;
  const localCopyOf = (vaultKey: string) => {
    const existing = localCopies.get(vaultKey) ?? createMemoryProvider({ now: writtenAt });
    localCopies.set(vaultKey, existing);
    return existing;
  };
  const processWipe = createFakeProcessWipe();
  /** What a phone's Keystore keeps across restarts: shared by every store this device starts. */
  const keptQuickLocks = new Map<string, string>();
  const quickKeep = createQuickKeep(
    {
      read: vaultKey => keptQuickLocks.get(vaultKey) ?? null,
      write: (vaultKey, text) => void keptQuickLocks.set(vaultKey, text),
      remove: vaultKey => void keptQuickLocks.delete(vaultKey),
    },
    createFakeKdf(),
    random
  );
  const keyCustody = createFakeKeyCustody(random);
  const biometrics = createFakeDeviceUnlock();
  const theme = createFakeThemeStore();
  const passkeys = aPasskeyAuthenticator(seed);
  const breached = new Set<string>();
  const saved: IFileToSave[] = [];
  const time = createFakeSessionClock();
  const signals = createFakeLockSignals();
  const openTabChannel = aTabHub();
  const clipboard = createFakeClipboard();
  let picked: { readonly bytes: Uint8Array<ArrayBuffer>; readonly name: string } | null = null;
  const startStore = (tab = signals) =>
    new VaultApp({
      codec: createInThreadCodec({
        argon2: createFakeKdf(),
        random,
        elapsed: () => 0 as Milliseconds,
      }),
      disposeCodec: () => undefined,
      forgetOnDevice: vaultKey => forgetVaultOnDevice(deviceStores, vaultKey),
      createStrengthMeter: () => ({
        estimate: () => Promise.resolve(null),
        dispose: () => undefined,
      }),
      probeWebDav: async (account, signal) => {
        const listed = await cloud.storeAt(account.endpoint)?.list(storagePath(''), signal);
        return ok({
          features: {
            conditionalRequests: false,
            moveReplace: true,
            revisionKind: 'etag' as const,
          },
          vaults: listed?.ok === true ? listed.value.filter(stat => isVaultFile(stat.path)) : [],
        });
      },
      pickVaultFile: () => Promise.resolve(picked),
      openGoogleDrive: () => ({
        auth: {
          prepare: () => Promise.resolve(false),
          authorize: () => Promise.resolve(err('unavailable')),
          token: () => Promise.resolve(err({ kind: 'auth-required' })),
          invalidate: () => undefined,
        },
        storage: createMemoryProvider(),
      }),
      connectCloud: cloud.connect,
      acquireLeadership: (_vaultKey, onLeader) => {
        onLeader();
        return () => undefined;
      },
      registry: deviceStores.registry,
      syncState: deviceStores.syncState,
      drafts: deviceStores.drafts,
      deviceConfig: deviceStores.deviceConfig,
      usage: deviceStores.usage,
      snapshots: deviceStores.snapshots,
      compressor: { compress: () => Promise.resolve(null) },
      localCopyOf,
      random,
      clock: time.clock,
      signals: tab.signals,
      clipboard: clipboard.clipboard,
      openTabChannel,
      wipe: processWipe.wipe,
      custody: keyCustody.custody,
      pepper: createWebCryptoQuickPepper(),
      quickKeep: keepsQuickLocks ? quickKeep : undefined,
      deviceUnlock: biometrics.deviceUnlock,
      themeStore: theme.store,
      saveFile: file => {
        saved.push(file);
        return Promise.resolve('saved');
      },
      passkeys,
      identity: {
        createdBy: 'portfolio web',
        exporter: { rpId: 'vault.example', displayName: 'Password vault' },
      },
      demo: createDemoSeed({ random, clock: time.clock }),
      readKdbx: (_file, { password, keyFile }) =>
        Promise.resolve(
          password === KEEPASS_PASSWORD || keyFile?.[0] === KEEPASS_KEY_FILE[0]
            ? ok(keePassBatch())
            : err('wrong-password')
        ),
      fetchSiteIcon: domain => {
        siteIconRequests.push(domain);
        const answer = siteIcons[domain];
        return Promise.resolve(
          answer === 'icon'
            ? { kind: 'icon' as const, png: Uint8Array.of(0x89, 0x50, 0x4e, 0x47) }
            : answer === 'none'
              ? { kind: 'none' as const }
              : { kind: 'failed' as const }
        );
      },
      readQrCode: image => Promise.resolve(new TextDecoder().decode(image.bytes) || null),
      auditSources: {
        meter: () => ({
          estimate: password =>
            Promise.resolve({
              score: password.length < WEAK_LENGTH ? 1 : 4,
              offlineCrackTime: '',
              warning: null,
              suggestions: [],
            }),
          dispose: () => undefined,
        }),
        breaches: { count: password => Promise.resolve(breached.has(password) ? 1 : 0) },
        loadTwoFactorDirectory: () => Promise.resolve(new Set(['github.com'])),
      },
    });
  return {
    startStore,
    keptQuickLocks,
    /** What every app on this device wrote to the clipboard, a clear as an empty string. */
    clipboardWrites: () => clipboard.writes,
    /** The file the next pick returns; `null` is a chooser closed without one. */
    willPick: (file: { readonly bytes: Uint8Array<ArrayBuffer>; readonly name: string } | null) => {
      picked = file;
    },
    reloads: processWipe.wipes,
    heldKey: keyCustody.held,
    biometrics,
    theme,
    passkeys,
    breached,
    saved,
    localCopyOf,
    signals,
    time,
    cloud,
    snapshots: deviceStores.snapshots,
    siteIconRequests,
  };
}

export const TEST_PASSWORD = 'correct horse battery staple';
export const KEEPASS_PASSWORD = 'keepass master';
/** The key file that alone opens the fake KeePass database. */
export const KEEPASS_KEY_FILE = Uint8Array.of(42, 1, 2, 3);

/** What the KeePass Worker answers for a file opened with `KEEPASS_PASSWORD`: one account. */
function keePassBatch(): IImportBatch {
  const template = INTERNET_ACCOUNT_TEMPLATE;
  return {
    source: 'keepass',
    cards: [
      plainCard(
        template,
        'From KeePass',
        templateTabs(template, { 'field.login': fill('jane') }, [])
      ),
    ],
    links: [],
    assets: [],
    warnings: [],
  };
}
export const TEST_FOLDER = 'https://dav.example.org/Vaults/';

/** A vault "Family" made on the device and kept in a WebDAV folder of its cloud, synced once. */
export async function linkedToWebDav(device = aDevice()) {
  const store = device.startStore();
  store.create('Family', TEST_PASSWORD);
  await when(() => store.session !== null);
  store.cloud.openWebDavForm();
  const form = store.cloud.webDavForm;
  form?.setEndpoint(TEST_FOLDER);
  form?.setUsername('me');
  form?.setPassword('app-password');
  await form?.runCheck();
  const session = store.session;
  if (session !== null) {
    await store.cloud.keepInWebDav(session);
  }
  await when(() => store.session?.cloud.status.kind === 'synced');
  return { device, store };
}

/** The same vault opened on another device from the cloud folder `linkedToWebDav` keeps it in. */
export async function openedFromTheCloud(device: ReturnType<typeof aDevice>): Promise<VaultApp> {
  const store = device.startStore();
  store.cloud.openWebDavForm();
  store.cloud.webDavForm?.setEndpoint(TEST_FOLDER);
  store.cloud.webDavForm?.setUsername('me');
  store.cloud.webDavForm?.setPassword('app-password');
  await store.cloud.webDavForm?.runCheck();
  store.choose((await store.cloud.openFromWebDav(storagePath('Family.pwv'))) ?? '');
  store.unlock(TEST_PASSWORD);
  await when(() => store.session?.cloud.status.kind === 'synced');
  return store;
}
