import type { IStorageProvider } from '@frozik/cloud-storage/core/storage-provider';
import type { TFieldSpec } from '@frozik/vault/model/card';
import type { ISealedRecordStore, TVaultKey } from '@frozik/vault/persistence/ports';
import type { IRandom } from '@frozik/vault/ports/random';

import type { IWebDavLink, IWebDavSource } from './cloud';
import type { TFillOutcome, TRequest, TResponseOf } from './messages';

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

/** The WebDAV password before the first unlock: in `storage.session`, until it can be sealed. */
/** A WebDAV link with no key to seal it under yet: until the next unlock, in memory that a browser restart wipes. */
export interface IPendingWebDavLink {
  load(): Promise<IWebDavLink | null>;
  save(link: IWebDavLink): Promise<void>;
  clear(): Promise<void>;
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
  readonly pendingWebDavLink: IPendingWebDavLink;
  readonly syncAlarm: ISyncAlarm;
  readonly random: IRandom;
  readonly sessionKeys: ISessionKeyStore;
  readonly setup: ISetupStore;
  readonly filler: IPageFiller;
  readonly clipboard: IExtensionClipboard;
  readonly restart: IRestart;
  readonly idleAlarm: IIdleAlarm;
  readonly protectedWindow: IProtectedWindow;
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
