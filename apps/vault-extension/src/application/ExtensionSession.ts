import type { IVaultCodec } from '@frozik/vault/codec/vault-codec';
import { importDek } from '@frozik/vault/crypto/dek';
import type { IKdf } from '@frozik/vault/crypto/kdf-port';
import { encodePassword } from '@frozik/vault/crypto/password-normalization';
import { unwrapSessionDek } from '@frozik/vault/format/session-dek';
import type { TUnlockFailure } from '@frozik/vault/lifecycle/lifecycle-state';
import type { IVaultCard } from '@frozik/vault/model/card';
import { allFields, fieldValues } from '@frozik/vault/model/card';
import { searchCards } from '@frozik/vault/model/card-search';
import type { TCardId, TFieldId } from '@frozik/vault/model/ids';
import { parseOtpUri } from '@frozik/vault/model/validation/otpauth-uri';
import type { IVaultDocument } from '@frozik/vault/model/vault-document';
import { oneTimeCode } from '@frozik/vault/otp/one-time-code';
import { vaultKeyOf } from '@frozik/vault/session/vault-key-of';
import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import type { ICardSummary, ICardView } from '../domain/card-views';
import { summaryOf, viewOf } from '../domain/card-views';
import type { IWebDavSource, TConnectOutcome, TPullOutcome } from '../domain/cloud';
import type { TExtensionStatus, TFillOutcome } from '../domain/messages';
import type { IExtensionServices, IFillRequest, ISessionKey } from '../domain/ports';
import { cardServesPage, cardsForPage } from '../domain/site-cards';
import { CloudCopy, LOCAL_COPY } from './CloudCopy';

/** The default idle lock, as on the web. */
export const IDLE_LOCK_MS = 5 * 60 * 1000;
/** A protected card stays open this long after the password is typed again. */
export const PROTECTED_OPEN_MS = 5 * 60 * 1000;

const LOGIN_KINDS: ReadonlySet<string> = new Set(['login', 'email']);
const SIGNAL = new AbortController().signal;

interface IOpened {
  readonly document: IVaultDocument;
  readonly name: string;
  /** The session's key, for sealing this browser's records and comparing a pulled file's key. */
  readonly dek: CryptoKey;
  readonly keyId: Uint8Array<ArrayBuffer>;
}

function firstValue(card: IVaultCard, kinds: ReadonlySet<string>): string | null {
  const field = allFields(card).find(candidate => kinds.has(candidate.spec.kind));
  return isNil(field) ? null : (fieldValues(field)[0] ?? null);
}

/**
 * The service worker's session: the vault opened from
 * its local copy with the key `chrome.storage.session` keeps, re-opened after
 * every wake-up; read-only; answers only what the popup asks for.
 */
export class ExtensionSession {
  private opened: IOpened | null = null;
  private readonly cloud: CloudCopy;

  constructor(
    private readonly services: IExtensionServices,
    private readonly codec: IVaultCodec,
    private readonly argon2: IKdf
  ) {
    this.cloud = new CloudCopy(services);
  }

  async status(): Promise<TExtensionStatus> {
    const setup = await this.services.setup.load();
    if (isNil(setup)) {
      return { kind: 'not-set-up' };
    }
    const opened = await this.open();
    return isNil(opened)
      ? { kind: 'locked', vaultName: setup.name }
      : { kind: 'unlocked', vaultName: setup.name };
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
  async connectWebDav(source: IWebDavSource, password: string): Promise<TConnectOutcome> {
    const outcome = await this.cloud.connect(source, password);
    if (outcome === 'connected') {
      this.opened = null;
    }
    return outcome;
  }

  /**
   * A newer cloud file replaces the copy and is opened next;
   * one under a key this session no longer has (a rotation) locks the extension.
   */
  async sync(): Promise<TPullOutcome> {
    const [setup, opened] = await Promise.all([this.services.setup.load(), this.open()]);
    if (isNil(setup) || isNil(opened)) {
      return 'no-cloud';
    }
    const outcome = await this.cloud.pull(setup, opened);
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
    await this.cloud.sealPendingLink(setup.vaultKey, opened.dek);
    await this.services.idleAlarm.set(IDLE_LOCK_MS);
    await this.services.syncAlarm.start();
    return null;
  }

  /** The key leaves the session store, then the extension reloads: memory goes with it. */
  async lock(): Promise<void> {
    await this.services.clipboard.clearPending();
    await this.services.sessionKeys.clear();
    await this.services.protectedWindow.save(0);
    await this.services.idleAlarm.cancel();
    await this.services.syncAlarm.stop();
    this.opened = null;
    this.services.restart.reload();
  }

  /** Every request of the popup is use: the idle lock starts over. */
  async touch(): Promise<void> {
    if (!isNil(this.opened)) {
      await this.services.idleAlarm.set(IDLE_LOCK_MS);
    }
  }

  async pageCards(pageUrl: string): Promise<readonly ICardSummary[]> {
    const opened = await this.open();
    return isNil(opened)
      ? []
      : cardsForPage(opened.document, pageUrl).map(({ card, match }) =>
          summaryOf(card, match === 'shared')
        );
  }

  async search(query: string): Promise<readonly ICardSummary[]> {
    const opened = await this.open();
    if (isNil(opened)) {
      return [];
    }
    const live = [...opened.document.cards.values()].filter(
      card => isNil(card.archivedAt) && isNil(card.trashedAt)
    );
    return searchCards(live, query).map(card => summaryOf(card, false));
  }

  async card(cardId: TCardId): Promise<ICardView | null> {
    const card = await this.cardOf(cardId);
    return isNil(card) ? null : viewOf(card);
  }

  /** The master password again, for a protected card's secrets. */
  async openProtected(password: string): Promise<TUnlockFailure | null> {
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
    await this.services.protectedWindow.save(this.services.now() + PROTECTED_OPEN_MS);
    return null;
  }

  async reveal(cardId: TCardId, fieldId: TFieldId): Promise<string | null> {
    const card = await this.secretsOf(cardId);
    const field = isNil(card) ? undefined : allFields(card).find(entry => entry.id === fieldId);
    return isNil(field) ? null : fieldValues(field).join('\n');
  }

  async copy(cardId: TCardId, fieldId: TFieldId): Promise<boolean> {
    const value = await this.reveal(cardId, fieldId);
    return isNil(value) ? false : this.services.clipboard.copy(value);
  }

  /** The current code of a TOTP field; HOTP stays with the web app, which owns its counter. */
  async copyCode(cardId: TCardId, fieldId: TFieldId): Promise<boolean> {
    const code = await this.codeOf(cardId, fieldId);
    return isNil(code) ? false : this.services.clipboard.copy(code);
  }

  /** Login, password and the current code, for a page the card's addresses allow. */
  async fill(
    cardId: TCardId,
    tabId: number,
    pageUrl: string,
    allowInsecure: boolean
  ): Promise<TFillOutcome> {
    const card = await this.secretsOf(cardId);
    if (isNil(card)) {
      return isNil(this.opened) ? 'locked' : 'not-allowed';
    }
    if (!cardServesPage(card, pageUrl)) {
      return 'other-site';
    }
    const otpField = allFields(card).find(field => field.spec.kind === 'otp');
    const request: IFillRequest = {
      username: firstValue(card, LOGIN_KINDS),
      password: firstValue(card, new Set(['password'])),
      otp: isNil(otpField) ? null : await this.codeOf(card.id, otpField.id),
      addresses: allFields(card).flatMap(field => {
        const { spec } = field;
        return spec.kind === 'url' ? fieldValues(field).map(stored => ({ stored, spec })) : [];
      }),
      allowInsecure,
    };
    return this.services.filler.fill(tabId, request);
  }

  private async codeOf(cardId: TCardId, fieldId: TFieldId): Promise<string | null> {
    const uri = await this.reveal(cardId, fieldId);
    const params = isNil(uri) ? null : parseOtpUri(uri);
    if (isNil(params) || !params.ok || params.value.type !== 'totp') {
      return null;
    }
    const code = await oneTimeCode(params.value, {
      kind: 'time',
      at: Temporal.Instant.fromEpochMilliseconds(this.services.now()),
    });
    return code.ok ? code.value.code : null;
  }

  private async cardOf(cardId: TCardId): Promise<IVaultCard | null> {
    const opened = await this.open();
    const card = opened?.document.cards.get(cardId);
    return isNil(card) || !isNil(card.trashedAt) ? null : card;
  }

  /** A card whose secrets may leave the worker now: a protected one only while it is open. */
  private async secretsOf(cardId: TCardId): Promise<IVaultCard | null> {
    const card = await this.cardOf(cardId);
    if (isNil(card)) {
      return null;
    }
    if (!card.protected) {
      return card;
    }
    return this.services.now() < (await this.services.protectedWindow.load()) ? card : null;
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
