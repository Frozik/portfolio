import 'fake-indexeddb/auto';

import { storagePath } from '@frozik/cloud-storage/core/storage-path';
import { createMemoryProvider } from '@frozik/cloud-storage/memory/memory-provider';
import type { Milliseconds } from '@frozik/utils/date/types';
import { err, ok } from '@frozik/utils/result/result';
import { createInThreadCodec } from '@frozik/vault/codec/in-thread-codec';
import { toHex } from '@frozik/vault/crypto/bytes';
import type { IImportBatch } from '@frozik/vault/import/imported-card';
import { fill, plainCard, templateTabs } from '@frozik/vault/import/template-card';
import { INTERNET_ACCOUNT_TEMPLATE } from '@frozik/vault/model/templates/internet-account';
import { createIndexedDbDeviceStores } from '@frozik/vault/persistence/indexeddb/device-stores';
import { forgetVaultOnDevice } from '@frozik/vault/session/forget-vault';
import { createFakeKdf } from '@frozik/vault/testing/fake-kdf';
import { createSeededRandom } from '@frozik/vault/testing/seeded-random';
import { isNil } from 'lodash-es';
import { when } from 'mobx';
import { Temporal } from 'temporal-polyfill';

import type { IWebDavSecrets, TConnectCloud } from '../domain/ports/cloud';
import type { IFileToSave } from '../domain/ports/file-saver';
import type { IPasskeys } from '../domain/ports/passkeys';
import type { ITabChannel, TTabMessage } from '../domain/ports/tab-channel';
import { createFakePageSignals } from './fake-page-signals.test-helper';
import { createFakeSessionClock } from './fake-session-clock.test-helper';
import { VaultFeatureStore } from './VaultFeatureStore';

let database = 0;
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
  const prf = async (secret: Uint8Array<ArrayBuffer>, salt: Uint8Array<ArrayBuffer>) =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from([...secret, ...salt])));
  const passkeys: IPasskeys & { answer(next: typeof answer): void } = {
    answer: next => {
      answer = next;
    },
    supported: () => Promise.resolve(true),
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
}: {
  readonly cloud?: ReturnType<typeof aCloud>;
  readonly seed?: number;
  /** What the icon service answers by domain; any other domain gets no answer, so nothing changes. */
  readonly siteIcons?: Readonly<Record<string, 'icon' | 'none'>>;
} = {}) {
  const siteIconRequests: string[] = [];
  const random = createSeededRandom(seed);
  const deviceStores = createIndexedDbDeviceStores(random, `pwv:test-${(database += 1)}`);
  const localCopies = new Map<string, ReturnType<typeof createMemoryProvider>>();
  let writes = 0;
  const writtenAt = () => (writes += 1) as Milliseconds;
  const localCopyOf = (vaultKey: string) => {
    const existing = localCopies.get(vaultKey) ?? createMemoryProvider({ now: writtenAt });
    localCopies.set(vaultKey, existing);
    return existing;
  };
  let reloads = 0;
  const passkeys = aPasskeyAuthenticator(seed);
  const breached = new Set<string>();
  const saved: IFileToSave[] = [];
  const time = createFakeSessionClock();
  const page = createFakePageSignals();
  const openTabChannel = aTabHub();
  const startStore = (tabPage = page) =>
    new VaultFeatureStore({
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
      probeWebDav: () =>
        Promise.resolve(
          ok({
            features: {
              conditionalRequests: false,
              moveReplace: true,
              revisionKind: 'etag' as const,
            },
            vaults: [],
          })
        ),
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
      snapshots: deviceStores.snapshots,
      compressor: { compress: () => Promise.resolve(null) },
      localCopyOf,
      random,
      clock: time.clock,
      page: tabPage.page,
      clipboard: {
        write: () => Promise.resolve(true),
        hasFocus: () => true,
        onceFocused: () => () => undefined,
        clearAfterReload: () => undefined,
      },
      openTabChannel,
      reload: () => {
        reloads += 1;
      },
      saveFile: file => {
        saved.push(file);
        return Promise.resolve('saved');
      },
      passkeys,
      exporter: { rpId: 'vault.example', displayName: 'Password vault' },
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
    reloads: () => reloads,
    passkeys,
    breached,
    saved,
    localCopyOf,
    page,
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
export async function openedFromTheCloud(
  device: ReturnType<typeof aDevice>
): Promise<VaultFeatureStore> {
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
