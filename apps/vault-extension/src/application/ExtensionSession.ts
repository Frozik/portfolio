import type { IVaultCodec } from '@frozik/vault/codec/vault-codec';
import { importDek } from '@frozik/vault/crypto/dek';
import type { IKdf } from '@frozik/vault/crypto/kdf-port';
import { encodePassword } from '@frozik/vault/crypto/password-normalization';
import { unwrapSessionDek } from '@frozik/vault/format/session-dek';
import type { IVaultDocument } from '@frozik/vault/model/vault-document';
import type { TUnlockFailure } from '@frozik/vault/session/unlock-failure';
import { vaultKeyOf } from '@frozik/vault/session/vault-key-of';
import { isNil } from 'lodash-es';

import type { TDriveSpace } from '@frozik/cloud-storage/google-drive/drive-space';

import type {
  IDriveSource,
  IWebDavSource,
  TConnectOutcome,
  TDriveSearch,
  TPullOutcome,
} from '../domain/cloud';
import type { TExtensionStatus, TQuickUnlockOutcome } from '../domain/messages';
import type { IExtensionServices, ISessionKey, ISetup } from '../domain/ports';
import { CloudCopy, LOCAL_COPY } from './CloudCopy';
import { ExtensionCards } from './ExtensionCards';
import { ExtensionQuickLock } from './ExtensionQuickLock';

/** The default idle lock, as on the web. */
export const IDLE_LOCK_MS = 5 * 60 * 1000;
/** A protected card stays open this long after the password is typed again. */
export const PROTECTED_OPEN_MS = 5 * 60 * 1000;

const SIGNAL = new AbortController().signal;

interface IOpened {
  readonly document: IVaultDocument;
  readonly name: string;
  /** The session's key, for sealing this browser's records and comparing a pulled file's key. */
  readonly dek: CryptoKey;
  readonly keyId: Uint8Array<ArrayBuffer>;
}

/**
 * The service worker's session: the vault opened from
 * its local copy with the key `chrome.storage.session` keeps, re-opened after
 * every wake-up; read-only; answers only what the popup asks for.
 */
export class ExtensionSession {
  private opened: IOpened | null = null;
  private readonly cloud: CloudCopy;
  private readonly quick: ExtensionQuickLock;
  /** What the popup reads and fills, from the vault this session opened. */
  readonly cards: ExtensionCards;

  constructor(
    private readonly services: IExtensionServices,
    private readonly codec: IVaultCodec,
    private readonly argon2: IKdf
  ) {
    this.cloud = new CloudCopy(services);
    this.quick = new ExtensionQuickLock({ ...services, expiry: services.quickExpiry });
    this.cards = new ExtensionCards(services, async () => (await this.open())?.document ?? null);
  }

  async status(): Promise<TExtensionStatus> {
    const setup = await this.services.setup.load();
    if (isNil(setup)) {
      return { kind: 'not-set-up' };
    }
    const opened = await this.open();
    if (isNil(opened)) {
      const prompt = await this.quick.prompt();
      return isNil(prompt)
        ? { kind: 'locked', vaultName: setup.name }
        : { kind: 'quick-locked', vaultName: setup.name, digits: prompt.digits };
    }
    return {
      kind: 'unlocked',
      vaultName: setup.name,
      quickUnlock: await this.withKey(key => this.quick.isSetUp(key), false),
      reminderDue: await this.quick.reminderDue(setup.vaultKey),
    };
  }

  /** The idle lock and the lock button: behind the PIN when there is one, otherwise full. */
  async lockQuickly(): Promise<void> {
    if (await this.withKey(key => this.quick.lock(key), false)) {
      await this.setAside();
    } else {
      await this.lock();
    }
  }

  /** The PIN's one try; a wrong one leaves the master password as the only way in. */
  async quickUnlock(pin: string): Promise<TQuickUnlockOutcome> {
    const key = await this.quick.open(pin);
    return !isNil(key) && (await this.adopt(key)) ? 'opened' : 'wrong-pin';
  }

  /** A PIN for this browser, under the master password typed again. */
  async setUpQuickUnlock(password: string, pin: string): Promise<boolean> {
    if (!isNil(await this.checkPassword(password))) {
      return false;
    }
    const setup = await this.services.setup.load();
    if (!isNil(setup)) {
      await this.quick.masterTyped(setup.vaultKey);
    }
    return this.withKey(key => this.quick.setUp(key, pin), false);
  }

  switchOffQuickUnlock(): Promise<void> {
    return this.withKey(key => this.quick.switchOff(key), undefined);
  }

  /** The weekly reminder: the master password, checked, starts the week over. */
  async remind(password: string): Promise<boolean> {
    const setup = await this.services.setup.load();
    if (isNil(setup) || !isNil(await this.checkPassword(password))) {
      return false;
    }
    await this.quick.masterTyped(setup.vaultKey);
    return true;
  }

  /** The session's key for one step, zeroed after it. */
  private async withKey<T>(step: (key: ISessionKey) => Promise<T>, without: T): Promise<T> {
    const key = await this.services.sessionKeys.load();
    if (isNil(key)) {
      return without;
    }
    try {
      return await step(key);
    } finally {
      key.rawDek.fill(0);
    }
  }

  /** A vault file chosen from disk becomes the copy the extension keeps. */
  async openFile(file: Uint8Array<ArrayBuffer>, name: string): Promise<boolean> {
    const vaultKey = vaultKeyOf(file);
    if (isNil(vaultKey)) {
      return false;
    }
    const written = await this.services
      .localCopyOf(vaultKey)
      .write(LOCAL_COPY, file, { kind: 'overwrite' }, SIGNAL);
    if (!written.ok) {
      return false;
    }
    await this.services.sessionKeys.clear();
    await this.cloud.forget(vaultKey);
    await this.services.setup.save({
      vaultKey,
      name: name.replace(/\.pwv$/i, ''),
      cloudRev: null,
    });
    this.opened = null;
    return true;
  }

  /** The vault file in a WebDAV folder becomes the copy, and is pulled again while unlocked. */
  connectWebDav(source: IWebDavSource, password: string): Promise<TConnectOutcome> {
    return this.connect(this.cloud.connect({ kind: 'webdav', source, password }));
  }

  findDriveVaults(space: TDriveSpace, folder: string): Promise<TDriveSearch> {
    return this.cloud.findDriveVaults(space, folder);
  }

  /** A vault file found in Google Drive becomes the copy, and is pulled again while unlocked. */
  connectDrive(source: IDriveSource): Promise<TConnectOutcome> {
    return this.connect(this.cloud.connect({ kind: 'google-drive', source }));
  }

  /**
   * A newer cloud file replaces the copy and is opened next;
   * one under a key this session no longer has (a rotation) locks the extension.
   */
  sync(): Promise<TPullOutcome> {
    return this.pullWith((setup, opened) => this.cloud.pull(setup, opened));
  }

  /** Google's window for the vault's account, when its token could not be renewed unseen. */
  signInToDrive(): Promise<TPullOutcome> {
    return this.pullWith((setup, opened) => this.cloud.signInAgain(setup, opened));
  }

  private async connect(connecting: Promise<TConnectOutcome>): Promise<TConnectOutcome> {
    const outcome = await connecting;
    if (outcome === 'connected') {
      this.opened = null;
    }
    return outcome;
  }

  private async pullWith(
    pull: (setup: ISetup, opened: IOpened) => Promise<TPullOutcome>
  ): Promise<TPullOutcome> {
    const [setup, opened] = await Promise.all([this.services.setup.load(), this.open()]);
    if (isNil(setup) || isNil(opened)) {
      return 'no-cloud';
    }
    const outcome = await pull(setup, opened);
    if (outcome === 'updated') {
      this.opened = null;
    }
    if (outcome === 'rotated') {
      await this.lock();
    }
    return outcome;
  }

  async unlock(password: string): Promise<TUnlockFailure | null> {
    const setup = await this.services.setup.load();
    const file = isNil(setup) ? null : await this.localFile(setup.vaultKey);
    if (isNil(setup) || isNil(file)) {
      return 'not-found';
    }
    const unwrapped = await unwrapSessionDek(
      file,
      { kind: 'password', password: encodePassword(password) },
      this.argon2
    );
    if (!unwrapped.ok) {
      return unwrapped.error.kind === 'wrong-password' ? 'wrong-password' : 'corrupted';
    }
    const key = { vaultKey: setup.vaultKey, ...unwrapped.value };
    const opened = await this.openWith(key, setup.name, file);
    if (isNil(opened)) {
      unwrapped.value.rawDek.fill(0);
      return 'corrupted';
    }
    await this.services.sessionKeys.save(key);
    unwrapped.value.rawDek.fill(0);
    await this.quick.end();
    await this.quick.masterTyped(setup.vaultKey);
    await this.cloud.sealPendingLink(setup.vaultKey, opened.dek);
    await this.services.idleAlarm.set(IDLE_LOCK_MS);
    await this.services.syncAlarm.start();
    return null;
  }

  /** The key leaves the session store, then the extension reloads: memory goes with it. */
  async lock(): Promise<void> {
    await this.services.clipboard.clearPending();
    await this.quick.end();
    await this.services.sessionKeys.clear();
    await this.services.protectedWindow.save(0);
    await this.services.idleAlarm.cancel();
    await this.services.syncAlarm.stop();
    this.opened = null;
    this.services.restart.reload();
  }

  /**
   * The extension forgets its vault — the copy, where it came from, Google's
   * token — and locks; the file in the cloud and the web app's copy stay.
   */
  async reset(): Promise<void> {
    const setup = await this.services.setup.load();
    if (!isNil(setup)) {
      await this.services
        .localCopyOf(setup.vaultKey)
        .remove(LOCAL_COPY, { kind: 'overwrite' }, SIGNAL);
      await this.cloud.forget(setup.vaultKey);
    }
    await this.services.googleDrive.signOut();
    await this.services.setup.clear();
    await this.lock();
  }

  /** Every request of the popup is use: the idle lock starts over. */
  async touch(): Promise<void> {
    if (!isNil(this.opened)) {
      await this.services.idleAlarm.set(IDLE_LOCK_MS);
    }
  }

  /** The master password again, for a protected card's secrets. */
  async openProtected(password: string): Promise<TUnlockFailure | null> {
    const checked = await this.checkPassword(password);
    if (!isNil(checked)) {
      return checked;
    }
    await this.services.protectedWindow.save(this.services.now() + PROTECTED_OPEN_MS);
    return null;
  }

  /** Whether the password opens the kept copy; nothing changes either way. */
  async checkPassword(password: string): Promise<TUnlockFailure | null> {
    const setup = await this.services.setup.load();
    const file = isNil(setup) ? null : await this.localFile(setup.vaultKey);
    if (isNil(file)) {
      return 'not-found';
    }
    const checked = await unwrapSessionDek(
      file,
      { kind: 'password', password: encodePassword(password) },
      this.argon2
    );
    if (!checked.ok) {
      return 'wrong-password';
    }
    checked.value.rawDek.fill(0);
    return null;
  }

  /** A key given back by the quick lock opens the session as an unlock does. */
  async adopt(key: ISessionKey): Promise<boolean> {
    const setup = await this.services.setup.load();
    const file = isNil(setup) ? null : await this.localFile(setup.vaultKey);
    if (isNil(setup) || isNil(file) || setup.vaultKey !== key.vaultKey) {
      return false;
    }
    const opened = await this.openWith(key, setup.name, file);
    if (!isNil(opened)) {
      await this.services.sessionKeys.save(key);
      await this.services.idleAlarm.set(IDLE_LOCK_MS);
      await this.services.syncAlarm.start();
    }
    key.rawDek.fill(0);
    return !isNil(opened);
  }

  /** The quick lock took the key: the open vault leaves this worker's memory, nothing reloads. */
  async setAside(): Promise<void> {
    await this.services.clipboard.clearPending();
    await this.services.sessionKeys.clear();
    await this.services.protectedWindow.save(0);
    await this.services.idleAlarm.cancel();
    await this.services.syncAlarm.stop();
    this.opened = null;
  }

  private async localFile(vaultKey: string): Promise<Uint8Array<ArrayBuffer> | null> {
    const read = await this.services.localCopyOf(vaultKey).read(LOCAL_COPY, SIGNAL);
    return read.ok ? (read.value?.bytes ?? null) : null;
  }

  /** A worker woken up opens the copy again with the session's key; none means locked. */
  private async open(): Promise<IOpened | null> {
    if (!isNil(this.opened)) {
      return this.opened;
    }
    const [key, setup] = await Promise.all([
      this.services.sessionKeys.load(),
      this.services.setup.load(),
    ]);
    if (isNil(key) || isNil(setup) || key.vaultKey !== setup.vaultKey) {
      return null;
    }
    const file = await this.localFile(setup.vaultKey);
    const opened = isNil(file) ? null : await this.openWith(key, setup.name, file);
    key.rawDek.fill(0);
    return opened;
  }

  /** The copy opened with a session key; the raw bytes stay the caller's to keep or zero. */
  private async openWith(
    key: ISessionKey,
    name: string,
    file: Uint8Array<ArrayBuffer>
  ): Promise<IOpened | null> {
    const dek = await importDek(key.rawDek);
    const opened = await this.codec.open(file, { kind: 'session', dek, keyId: key.keyId }, SIGNAL);
    this.opened = opened.ok
      ? { document: opened.value.document, name, dek, keyId: key.keyId }
      : null;
    return this.opened;
  }
}
