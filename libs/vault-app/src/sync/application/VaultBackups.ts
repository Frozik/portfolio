import type { IStorageProvider } from '@frozik/cloud-storage/core/storage-provider';
import type { Milliseconds } from '@frozik/utils/date/types';
import type { ValueDescriptor } from '@frozik/utils/value-descriptors/types';
import {
  createSyncedValueDescriptor,
  createUnsyncedValueDescriptor,
  EMPTY_VD,
} from '@frozik/utils/value-descriptors/utils';
import type { IVaultCodec } from '@frozik/vault/codec/vault-codec';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import type { IRollbackSummary } from '@frozik/vault/model/rollback';
import { rollbackTo } from '@frozik/vault/model/rollback';
import type {
  ISnapshotEntry,
  ISnapshotStore,
  TSnapshotReason,
  TVaultKey,
} from '@frozik/vault/persistence/ports';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';

import { vaultErrorFail } from '../../device/domain/vault-error-fail';
import type { TTransact } from '../../document/application/transact';
import type { ISessionClock } from '../../session/domain/ports/session-clock';
import { LOCAL_COPY_PATH } from '../domain/local-copy';

/** Edits keep the vault as it was before them at most this often. */
export const PERIODIC_BACKUP_MS = 60 * 60 * 1000;

export type TRestoreOutcome =
  | { readonly kind: 'restored'; readonly summary: IRollbackSummary }
  /** Sealed with a key the vault no longer has: taken before a key rotation. */
  | { readonly kind: 'older-key' }
  | { readonly kind: 'unreadable' };

export interface IVaultBackupsInputs {
  readonly vaultKey: TVaultKey;
  readonly snapshots: ISnapshotStore;
  readonly localCopy: IStorageProvider;
  /** A backup's file opened with the vault's current key. */
  readonly open: (file: TBytes, signal: AbortSignal) => ReturnType<IVaultCodec['open']>;
  readonly clock: ISessionClock;
  /** How many this device keeps of this vault. */
  readonly keep: () => number;
  readonly transact: TTransact;
  readonly signal: AbortSignal;
}

/**
 * Earlier versions of the vault on this device, sealed as the local copy is:
 * kept before a cloud version changes it, before a rollback, and once an hour
 * of edits; the vault can be rolled back to any of them.
 */
export class VaultBackups {
  entries: ValueDescriptor<readonly ISnapshotEntry[]> = EMPTY_VD;
  restoring = false;

  private lastTakenAt: Promise<number | null> | null = null;

  constructor(private readonly inputs: IVaultBackupsInputs) {
    makeAutoObservable<VaultBackups, 'inputs' | 'lastTakenAt'>(
      this,
      { entries: observableRef, inputs: false, lastTakenAt: false },
      { autoBind: true }
    );
  }

  /** The local copy as it is now, before something changes it. */
  async keep(reason: TSnapshotReason): Promise<void> {
    const { vaultKey, localCopy, snapshots, clock, keep, signal } = this.inputs;
    const takenAt = clock.now();
    this.lastTakenAt = Promise.resolve(takenAt);
    const read = await localCopy.read(LOCAL_COPY_PATH, signal);
    if (!read.ok || isNil(read.value)) {
      return;
    }
    await snapshots.add(
      vaultKey,
      { takenAt: takenAt as Milliseconds, reason, file: read.value.bytes },
      keep()
    );
    if (this.entries !== EMPTY_VD) {
      await this.refresh();
    }
  }

  /** Called with every edit: the version before it is kept once the last one is an hour old. */
  noteEdit(): void {
    void this.keepIfDue();
  }

  async refresh(): Promise<void> {
    const listed = await this.inputs.snapshots.list(this.inputs.vaultKey);
    runInAction(() => {
      this.entries = listed.ok
        ? createSyncedValueDescriptor(listed.value)
        : createUnsyncedValueDescriptor(vaultErrorFail(listed.error));
    });
  }

  /** Back to a backup, as one edit; the version before the rollback is kept first, so it can be undone. */
  async restore(id: number): Promise<TRestoreOutcome> {
    this.restoring = true;
    try {
      return await this.rollBack(id);
    } finally {
      runInAction(() => {
        this.restoring = false;
      });
    }
  }

  private async rollBack(id: number): Promise<TRestoreOutcome> {
    const { vaultKey, snapshots, open, transact, signal } = this.inputs;
    const file = await snapshots.read(vaultKey, id);
    if (!file.ok || isNil(file.value)) {
      return { kind: 'unreadable' };
    }
    const opened = await open(file.value, signal);
    if (!opened.ok) {
      return opened.error.kind === 'key-rotated' ? { kind: 'older-key' } : { kind: 'unreadable' };
    }
    await this.keep('before-restore');
    const summary = transact((document, at) => {
      const rolledBack = rollbackTo(document, opened.value.document, at);
      return { document: rolledBack.document, result: rolledBack.summary };
    });
    await this.refresh();
    return isNil(summary) ? { kind: 'unreadable' } : { kind: 'restored', summary };
  }

  private async keepIfDue(): Promise<void> {
    this.lastTakenAt ??= this.newestTakenAt();
    const last = await this.lastTakenAt;
    if (isNil(last) || this.inputs.clock.now() - last >= PERIODIC_BACKUP_MS) {
      await this.keep('periodic');
    }
  }

  private async newestTakenAt(): Promise<number | null> {
    const listed = await this.inputs.snapshots.list(this.inputs.vaultKey);
    return listed.ok ? (listed.value[0]?.takenAt ?? null) : null;
  }
}
