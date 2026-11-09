import { action, makeObservable, observableRef, reaction, runInAction } from 'mobx';

import type { IDiagnosticsLog } from '../../diagnostics/domain/ports/diagnostics-log';
import { mergeBooks } from '../../grouping/domain/book-merge';
import type { GroupBook } from '../../grouping/domain/group-book';
import { sameValue } from '../../grouping/domain/same-value';
import type { IClock } from '../../policy/domain/ports/clock';
import type { ICloudCopy, TCloudFailure } from '../domain/ports/cloud-copy';
import type { IGoogleAccount } from '../domain/ports/google-account';
import type { ISyncConnection, ISyncStore } from '../domain/ports/sync-store';
import type { TSyncState } from '../domain/sync-state';

/** Rounds of read–merge–write before giving up on a cloud that keeps changing under us. */
const ROUNDS = 3;
/** Edits come in bursts (a move is several); one sync after the burst settles. */
const AFTER_EDIT_MS = 5_000;

export interface ISyncPorts {
  /** The cloud copy in the Drive of an account (`null`: the one account the phone has). */
  readonly cloudOf: (account: string | null) => ICloudCopy;
  readonly store: ISyncStore;
  readonly google: IGoogleAccount;
  readonly clock: IClock;
  readonly diagnostics: IDiagnosticsLog;
}

/** The group book this phone holds, as sync reads and replaces it. */
export interface IBookAccess {
  book(): GroupBook;
  replace(book: GroupBook): void;
}

/**
 * Keeps the group book in the user's own Drive: read the cloud copy, merge it with this phone's
 * against the copy both had last time, write it back naming the version read. Never blocks the
 * screens, never overwrites a cloud file it cannot read.
 */
export class SyncModel {
  state: TSyncState = { kind: 'off' };
  connection: ISyncConnection | null = null;
  private base: GroupBook | null = null;
  private running: Promise<void> | null = null;

  constructor(
    private readonly ports: ISyncPorts,
    private readonly books: IBookAccess
  ) {
    makeObservable<SyncModel, 'setState'>(this, {
      state: observableRef,
      connection: observableRef,
      setState: action,
    });
  }

  get connected(): boolean {
    return this.connection !== null;
  }

  async load(): Promise<void> {
    const memory = await this.ports.store.load();
    runInAction(() => {
      this.connection = memory.connection;
    });
    this.base = memory.base;
  }

  private get cloud(): ICloudCopy | null {
    return this.connection === null ? null : this.ports.cloudOf(this.connection.account);
  }

  async connect(): Promise<void> {
    const outcome = await this.ports.google.connect();
    if (outcome.kind !== 'connected') {
      this.ports.diagnostics.log('warn', 'sync', `connect-${outcome.kind}`);
      return;
    }
    const connection = { account: outcome.account };
    runInAction(() => {
      this.connection = connection;
    });
    this.base = null;
    await this.ports.store.save({ connection, base: null });
    this.ports.diagnostics.log('info', 'sync', 'connected');
    await this.syncNow();
  }

  async disconnect(): Promise<void> {
    const { connection } = this;
    if (connection !== null) {
      await this.ports.google.disconnect(connection.account);
    }
    runInAction(() => {
      this.connection = null;
    });
    this.base = null;
    this.setState({ kind: 'off' });
    await this.ports.store.save({ connection: null, base: null });
    this.ports.diagnostics.log('info', 'sync', 'disconnected');
  }

  /** One sync at a time; a request during one waits for it. */
  syncNow(): Promise<void> {
    if (!this.connected) {
      return Promise.resolve();
    }
    this.running ??= this.run().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /** Syncs a few seconds after the book last changed; returns the stop. */
  follow(): () => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stop = reaction(
      () => this.books.book(),
      () => {
        if (timer !== null) {
          clearTimeout(timer);
        }
        timer = setTimeout(() => void this.syncNow(), AFTER_EDIT_MS);
      }
    );
    return () => {
      stop();
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }

  /** The cloud file could not be read: the user chose to replace it with this phone's book. */
  async replaceCloudCopy(): Promise<void> {
    const { cloud } = this;
    const read = await cloud?.read();
    if (cloud === null || read?.kind !== 'unreadable') {
      await this.syncNow();
      return;
    }
    const written = await cloud.write(this.books.book(), read.rev);
    this.ports.diagnostics.log('warn', 'sync', 'cloud-copy-replaced', { result: written.kind });
    await this.syncNow();
  }

  private async run(): Promise<void> {
    const { cloud } = this;
    if (cloud === null) {
      return;
    }
    this.setState({ kind: 'syncing' });
    for (let round = 0; round < ROUNDS; round += 1) {
      const local = this.books.book();
      const read = await cloud.read();
      if (read.kind === 'failed') {
        this.fail(read.failure);
        return;
      }
      if (read.kind === 'unreadable') {
        this.ports.diagnostics.log('error', 'sync', 'cloud-copy-unreadable');
        this.setState({ kind: 'unreadable' });
        return;
      }
      const merged = read.kind === 'absent' ? local : mergeBooks(this.base, local, read.book);
      if (read.kind === 'absent' || !sameValue(merged, read.book)) {
        const written = await cloud.write(merged, read.kind === 'found' ? read.rev : null);
        if (written.kind === 'failed') {
          this.fail(written.failure);
          return;
        }
        if (written.kind === 'conflict') {
          this.ports.diagnostics.log('debug', 'sync', 'conflict-retry');
          continue;
        }
      }
      if (this.books.book() !== local) {
        continue;
      }
      if (!sameValue(merged, local)) {
        this.books.replace(merged);
      }
      this.base = merged;
      await this.ports.store.save({ connection: this.connection, base: merged });
      this.setState({ kind: 'synced', at: this.ports.clock.now() });
      this.ports.diagnostics.log('info', 'sync', 'synced', {
        merged: String(!sameValue(merged, local)),
      });
      return;
    }
    this.fail('server');
  }

  private fail(failure: TCloudFailure): void {
    const since = this.state.kind === 'failed' ? this.state.since : this.ports.clock.now();
    this.setState({ kind: 'failed', failure, since });
    this.ports.diagnostics.log(
      failure === 'offline' ? 'info' : 'warn',
      'sync',
      `failed-${failure}`
    );
  }

  private setState(state: TSyncState): void {
    this.state = state;
  }
}
