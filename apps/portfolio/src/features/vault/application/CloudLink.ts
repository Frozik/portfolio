import type { TStorageResult } from '@frozik/cloud-storage/core/storage-error';
import { storagePath } from '@frozik/cloud-storage/core/storage-path';
import type {
  IStorageObject,
  IStorageProvider,
  TStoragePath,
  TStorageRev,
} from '@frozik/cloud-storage/core/storage-provider';
import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import type { ISealedJsonRecord } from '@frozik/vault/session/sealed-json-record';
import type { ISyncReplica } from '@frozik/vault/session/sync-effect-runner';
import type { ISyncState, TSyncStop } from '@frozik/vault/sync/sync-state';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';

import type { TCloudLocation } from '../domain/cloud-files';
import type { ICloudConnection, IWebDavSecrets, TConnectCloud } from '../domain/ports/cloud';
import type { TGoogleAuthFailure } from '../domain/ports/google-drive';
import type { TAcquireLeadership } from '../domain/ports/leadership';
import type { IPageSignals } from '../domain/ports/page-signals';
import type { ISessionClock } from '../domain/ports/session-clock';
import type { ICloudLinkRecord } from './cloud-link-record';
import type { TCloudStatus } from './cloud-status';
import { cloudStatusOf } from './cloud-status';
import { SyncController } from './SyncController';
import type { SyncRecord } from './SyncRecord';

/** Edits are pushed to the cloud this long after the last one. */
export const CLOUD_PUSH_DEBOUNCE_MS = 3000;
/** A visible tab looks for other devices' changes this often. */
export const CLOUD_PULL_EVERY_MS = 5 * 60 * 1000;

export interface ICloudLinkHost {
  readonly connect: TConnectCloud;
  /** Where the vault lives and the WebDAV password, sealed on this device with the vault's key. */
  readonly link: ISealedJsonRecord<ICloudLinkRecord>;
  readonly record: Pick<SyncRecord, 'cloudRev' | 'forgetCloud'>;
  /** The local copy as sealed now: what replaces a cloud file that belongs to another vault. */
  localFile(signal: AbortSignal): Promise<TStorageResult<IStorageObject | null>>;
  readonly vaultKey: string;
  readonly clock: ISessionClock;
  readonly page: IPageSignals;
  readonly acquireLeadership: TAcquireLeadership;
  replica(provider: IStorageProvider, path: TStoragePath): ISyncReplica;
  initialState(lastSyncedRev: TStorageRev | null): ISyncState;
  /** The session holds a newer slot set than the cloud has shown: it goes up first. */
  keysAheadOfCloud(): boolean;
  onStopped(stop: TSyncStop): void;
}

/**
 * The session's tie to its cloud: one engine, run only by
 * the tab holding the vault's lock; pushes coalesce for a few seconds, pulls
 * come at unlock, when the tab is shown again, every few minutes and when
 * the network returns. Drive's sign-in, when the token is gone, is a click.
 */
export class CloudLink {
  /** Where the vault lives, as read from the sealed record or linked now; `null` for a vault on this device only. */
  location: TCloudLocation | null = null;
  connection: ICloudConnection | null = null;
  /** A linked vault whose connection could not be built (WebDAV secrets missing). */
  unreachable = false;
  sync: SyncController | null = null;
  leader = false;

  private release: (() => void) | null = null;
  private stopFollowingPage: (() => void) | null = null;
  private cancelPush: (() => void) | null = null;
  /** Ends with the session: a link or a replacement that finishes later starts nothing. */
  private readonly controller = new AbortController();

  constructor(private readonly host: ICloudLinkHost) {
    makeAutoObservable<
      CloudLink,
      'host' | 'release' | 'stopFollowingPage' | 'cancelPush' | 'controller'
    >(
      this,
      {
        location: observableRef,
        connection: observableRef,
        sync: observableRef,
        host: false,
        release: false,
        stopFollowingPage: false,
        cancelPush: false,
        controller: false,
      },
      { autoBind: true }
    );
  }

  get status(): TCloudStatus {
    return cloudStatusOf({
      linked: !isNil(this.connection) || this.unreachable,
      reachable: !this.unreachable,
      leader: this.leader,
      sync: this.sync?.state ?? null,
    });
  }

  /** At unlock: a vault kept in a cloud picks its sync up where this device left it. */
  async restore(): Promise<void> {
    const record = await this.host.link.load();
    if (isNil(record) || this.controller.signal.aborted) {
      return;
    }
    runInAction(() => {
      this.location = record.location;
    });
    this.reconnect(record.location, record.webdav);
  }

  /**
   * The vault starts living in a cloud: WebDAV secrets are
   * sealed on this device and the engine starts from no revision (its first
   * cycle finds the file there, or writes it with `absent`).
   */
  async link(connection: ICloudConnection, secrets: IWebDavSecrets | null): Promise<void> {
    await this.host.link.save({ location: connection.location, webdav: secrets });
    await this.host.record.forgetCloud();
    if (!this.controller.signal.aborted) {
      runInAction(() => {
        this.location = connection.location;
      });
      this.attach(connection, null);
    }
  }

  /**
   * The cloud file belongs to another vault and the user chose
   * to replace it with this one: an explicit overwrite, the only one there is.
   */
  async replaceRemote(): Promise<TStorageResult<void>> {
    const { connection } = this;
    if (isNil(connection)) {
      return ok(undefined);
    }
    const { signal } = this.controller;
    const local = await this.host.localFile(signal);
    if (!local.ok || isNil(local.value)) {
      return local.ok ? err({ kind: 'not-found' }) : local;
    }
    const written = await connection.storage.write(
      storagePath(connection.location.path),
      local.value.bytes,
      { kind: 'overwrite' },
      signal
    );
    if (!written.ok) {
      return written;
    }
    await this.host.record.forgetCloud();
    if (!signal.aborted) {
      this.attach(connection, null);
    }
    return ok(undefined);
  }

  async unlink(): Promise<void> {
    this.detach();
    this.location = null;
    await this.host.link.clear();
    await this.host.record.forgetCloud();
  }

  private reconnect(location: TCloudLocation, secrets: IWebDavSecrets | null): void {
    const connection = this.host.connect(location, secrets);
    if (isNil(connection)) {
      this.detach();
      this.unreachable = true;
      return;
    }
    this.attach(connection, this.host.record.cloudRev);
  }

  private attach(connection: ICloudConnection, lastSyncedRev: TStorageRev | null): void {
    this.detach();
    this.connection = connection;
    void connection.googleAuth?.prepare();
    this.release = this.host.acquireLeadership(this.host.vaultKey, () =>
      this.lead(connection, lastSyncedRev)
    );
  }

  /**
   * "Sync now": an edit still waiting goes up at once — read, merged with
   * the cloud's file and written back only if that file did not change
   * meanwhile — else the cloud's news are taken and anything this side has
   * on top is written back the same way. A stopped sync stays stopped.
   */
  syncNow(): void {
    if (isNil(this.cancelPush)) {
      this.pull();
    } else {
      this.pushNow();
    }
  }

  /** The session's document changed: the cloud hears of it once the edits pause. */
  requestPush(): void {
    if (isNil(this.sync)) {
      return;
    }
    this.cancelPush?.();
    this.cancelPush = this.host.clock.after(CLOUD_PUSH_DEBOUNCE_MS, this.pushNow);
  }

  /** Must be called synchronously from a click: Google opens its popup there or not at all. */
  async signIn(): Promise<TResult<void, TGoogleAuthFailure>> {
    const auth = this.connection?.googleAuth;
    if (isNil(auth)) {
      return ok(undefined);
    }
    const authorized = await auth.authorize();
    if (authorized.ok) {
      this.sync?.dispatch({ kind: 'online' });
    }
    return authorized.ok ? ok(undefined) : err(authorized.error);
  }

  detach(): void {
    this.cancelPush?.();
    this.cancelPush = null;
    this.stopFollowingPage?.();
    this.stopFollowingPage = null;
    this.sync?.dispose();
    this.sync = null;
    this.release?.();
    this.release = null;
    this.leader = false;
    this.connection = null;
    this.unreachable = false;
  }

  dispose(): void {
    this.controller.abort();
    this.detach();
  }

  private lead(connection: ICloudConnection, lastSyncedRev: TStorageRev | null): void {
    if (this.connection !== connection) {
      return;
    }
    this.leader = true;
    this.sync = new SyncController(
      this.host.replica(connection.storage, storagePath(connection.location.path)),
      this.host.initialState(lastSyncedRev),
      { onStopped: this.host.onStopped }
    );
    const pushFirst = isNil(lastSyncedRev) || this.host.keysAheadOfCloud();
    this.sync.dispatch({ kind: pushFirst ? 'push-requested' : 'pull-requested' });
    this.followPage();
  }

  private followPage(): void {
    const { page, clock } = this.host;
    const stops = [
      page.onVisibilityChange(hidden => (hidden ? this.pushPending() : this.pull())),
      page.onOnline(() => this.sync?.dispatch({ kind: 'online' })),
      clock.every(CLOUD_PULL_EVERY_MS, () => {
        if (!page.isHidden()) {
          this.pull();
        }
      }),
    ];
    this.stopFollowingPage = () => stops.forEach(stop => stop());
  }

  private pull(): void {
    this.sync?.dispatch({ kind: 'pull-requested' });
  }

  /** A hidden tab may never come back: what waits for the debounce goes now, and only that. */
  private pushPending(): void {
    if (!isNil(this.cancelPush)) {
      this.pushNow();
    }
  }

  private pushNow(): void {
    this.cancelPush?.();
    this.cancelPush = null;
    this.sync?.dispatch({ kind: 'push-requested' });
  }
}
