import type { IStorageProvider } from '@frozik/cloud-storage/core/storage-provider';
import type { TDriveSpace } from '@frozik/cloud-storage/google-drive/drive-space';
import type { TResult } from '@frozik/utils/result/result';
import type { TFieldSpec } from '@frozik/vault/model/card';
import type { ISealedRecordStore, TVaultKey } from '@frozik/vault/persistence/ports';
import type { IRandom } from '@frozik/vault/ports/random';

import type { IWebDavSource, TCloudLink, IDriveSignInFailure } from './cloud';
import type { TFillOutcome, TRequest, TResponseOf } from './messages';
import type { ILastMasterStore, IQuickExpiryAlarm, IQuickLockStore } from './quick-unlock';

/** The session's key, in `chrome.storage.session`: gone with a restart, an update or a lock. */
export interface ISessionKey {
  readonly vaultKey: TVaultKey;
  readonly rawDek: Uint8Array<ArrayBuffer>;
  readonly keyId: Uint8Array<ArrayBuffer>;
}

export interface ISessionKeyStore {
  load(): Promise<ISessionKey | null>;
  save(key: ISessionKey): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Which vault the extension keeps a copy of: kept in the open across
 * restarts, so only its name — where it comes from is sealed with its key.
 */
export interface ISetup {
  readonly vaultKey: TVaultKey;
  readonly name: string;
  /** The cloud file's revision the local copy was last taken from. */
  readonly cloudRev: string | null;
}

export interface ISetupStore {
  load(): Promise<ISetup | null>;
  save(setup: ISetup): Promise<void>;
  clear(): Promise<void>;
}

type TUrlSpec = Extract<TFieldSpec, { readonly kind: 'url' }>;

/** What the fill script gets: the values, and the card's addresses each frame checks itself against. */
export interface IFillRequest {
  readonly username: string | null;
  readonly password: string | null;
  readonly otp: string | null;
  readonly addresses: readonly { readonly stored: string; readonly spec: TUrlSpec }[];
  /** A plain-HTTP page only after the user said yes in the popup. */
  readonly allowInsecure: boolean;
}

export interface IPageFiller {
  fill(tabId: number, request: IFillRequest): Promise<TFillOutcome>;
}

/** Written and cleared by the offscreen document, which outlives the popup. */
export interface IExtensionClipboard {
  copy(text: string): Promise<boolean>;
  /** A clear still waiting happens now: a lock reloads the extension and would cancel it. */
  clearPending(): Promise<void>;
}

/** Until when protected cards are open: in `storage.session`, so the worker's sleep does not close them early. */
export interface IProtectedWindow {
  load(): Promise<number>;
  save(until: number): Promise<void>;
}

/** The lock reloads the extension: nothing of the session survives in memory. */
export interface IRestart {
  reload(): void;
}

/** `chrome.alarms`: the lock after a while of no use, set again with every request. */
export interface IIdleAlarm {
  set(delayMs: number): Promise<void>;
  cancel(): Promise<void>;
}

/** A cloud link with no key to seal it under yet: until the next unlock, in memory that a browser restart wipes. */
export interface IPendingCloudLink {
  load(): Promise<TCloudLink | null>;
  save(link: TCloudLink): Promise<void>;
  clear(): Promise<void>;
}

/** Google sign-in and Drive; a token lives about an hour, in memory only. */
export interface IGoogleDriveAccess {
  /**
   * Google's own window, opened by the worker: the popup closes as the window takes focus. Answers
   * the account signed in, when Drive tells it.
   */
  signIn(
    space: TDriveSpace,
    account: string | null
  ): Promise<TResult<string | null, IDriveSignInFailure>>;
  /** The space with the token signed in; an expired one is renewed without a window, or the call answers `auth-required`. */
  open(space: TDriveSpace, account: string | null): IStorageProvider;
  /** The token goes: the next vault may live under another account. */
  signOut(): Promise<void>;
}

/** A pull every so often while unlocked; the lock stops it. */
export interface ISyncAlarm {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface IExtensionServices {
  readonly localCopyOf: (vaultKey: TVaultKey) => IStorageProvider;
  readonly openWebDav: (source: IWebDavSource, password: string) => IStorageProvider;
  /** Where the vault comes from and its credentials, sealed under the vault's key, in this browser. */
  readonly deviceConfig: ISealedRecordStore;
  readonly googleDrive: IGoogleDriveAccess;
  readonly pendingLink: IPendingCloudLink;
  readonly syncAlarm: ISyncAlarm;
  readonly random: IRandom;
  readonly sessionKeys: ISessionKeyStore;
  readonly setup: ISetupStore;
  readonly filler: IPageFiller;
  readonly clipboard: IExtensionClipboard;
  readonly restart: IRestart;
  readonly idleAlarm: IIdleAlarm;
  readonly protectedWindow: IProtectedWindow;
  /** The idle lock's key behind a PIN, when one is set up. */
  readonly quickLocks: IQuickLockStore;
  readonly lastMaster: ILastMasterStore;
  readonly quickExpiry: IQuickExpiryAlarm;
  readonly now: () => number;
}

/** The popup's one way to the worker: a request, its answer. */
export type TAskWorker = <Request extends TRequest>(
  request: Request
) => Promise<TResponseOf<Request>>;

/** The tab the popup was opened over: its id for filling, its address for finding the cards. */
export interface IActiveTab {
  readonly id: number;
  readonly url: string;
}
