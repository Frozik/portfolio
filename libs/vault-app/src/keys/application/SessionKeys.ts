import type { IStorageProvider } from '@frozik/cloud-storage/core/storage-provider';
import { isNonEmpty } from '@frozik/utils/collections/non-empty';
import type { TResult } from '@frozik/utils/result/result';
import type { IVaultCodec, TCodecError } from '@frozik/vault/codec/vault-codec';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import { encodePassword } from '@frozik/vault/crypto/password-normalization';
import type { TSlotSecret } from '@frozik/vault/format/keyslot-changes';
import { withoutPasskey } from '@frozik/vault/format/keyslot-changes';
import { mergeKeyslots, sameKeyslots } from '@frozik/vault/format/keyslot-merge';
import type { IVaultKeys } from '@frozik/vault/format/vault-keys';
import type { TUnlockFailure } from '@frozik/vault/session/unlock-failure';
import { unlockFailureOf } from '@frozik/vault/session/unlock-failure';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';

import type { IPasskeyAnswer } from '../domain/ports/passkeys';
import { checkMasterPassword } from './master-password-check';

export interface ISessionKeysServices {
  readonly codec: IVaultCodec;
  readonly localCopy: IStorageProvider;
  readonly signal: AbortSignal;
  /** The slots changed: both copies must be sealed with the new set. */
  readonly onChanged: () => void;
  /** The master password changed on this device: what was derived from or guarded by the old one goes. */
  readonly onPasswordChanged: () => void;
}

/** What proves the user may change the slots, as typed: the master password, or the recovery key that opened the vault. */
export type TCurrentSecret =
  | { readonly kind: 'password'; readonly password: string }
  | { readonly kind: 'recovery'; readonly recoveryKey: TBytes };

function slotSecretOf(secret: TCurrentSecret): TSlotSecret {
  return secret.kind === 'password'
    ? { kind: 'password', password: encodePassword(secret.password) }
    : { kind: 'recovery', recoveryKey: secret.recoveryKey.slice() };
}

/**
 * The key material the session seals with.
 * The key itself never changes here; the slot set does: the master password
 * or the recovery key changed on this device, or a newer set came in from
 * another one.
 */
export class SessionKeys {
  current: IVaultKeys;
  /** "the password was changed on another device", until the user has seen it. */
  changedElsewhere = false;
  /** Opened with the recovery key: a new master password is due. */
  recovering: boolean;

  /** The last slot set this device shares with the others: what its own changes are told apart from. */
  private base: IVaultKeys;

  constructor(
    initial: IVaultKeys,
    unlockedWith: 'password' | 'recovery' | 'prf',
    private readonly services: ISessionKeysServices
  ) {
    this.current = initial;
    this.base = initial;
    this.recovering = unlockedWith === 'recovery';
    makeAutoObservable<SessionKeys, 'services' | 'base'>(
      this,
      { current: observableRef, services: false, base: false },
      { autoBind: true }
    );
  }

  /** The passkeys that open the vault, by credential id. */
  get passkeys(): readonly TBytes[] {
    return this.current.keyslots.flatMap(slot => (slot.kind === 'prf' ? [slot.credentialId] : []));
  }

  get hasRecoveryKey(): boolean {
    return this.current.keyslots.some(slot => slot.kind === 'recovery');
  }

  /** The master password typed again; the reason it is wrong, or `null`. */
  check(password: string): Promise<TUnlockFailure | null> {
    const { codec, localCopy, signal } = this.services;
    return checkMasterPassword({ localCopy, codec, keyId: this.current.keyId }, password, signal);
  }

  /** A new password slot, written to both copies by the next seal. */
  async change(current: TCurrentSecret, nextPassword: string): Promise<TUnlockFailure | null> {
    const failure = await this.replace(keys =>
      this.services.codec.changePassword(
        keys,
        { current: slotSecretOf(current), next: encodePassword(nextPassword) },
        this.services.signal
      )
    );
    if (failure === null) {
      runInAction(() => {
        this.recovering = false;
      });
      this.services.onPasswordChanged();
    }
    return failure;
  }

  /** The recovery key the user has just written down; an earlier one stops working. */
  addRecoveryKey(password: string, recoveryKey: TBytes): Promise<TUnlockFailure | null> {
    return this.replace(keys =>
      this.services.codec.addRecoveryKey(
        keys,
        { current: slotSecretOf({ kind: 'password', password }), recoveryKey: recoveryKey.slice() },
        this.services.signal
      )
    );
  }

  /** A passkey of this device opens the vault from now on, on every device after sync. */
  addPasskey(
    password: string,
    passkey: IPasskeyAnswer,
    rpId: string
  ): Promise<TUnlockFailure | null> {
    return this.replace(keys =>
      this.services.codec.addPasskey(
        keys,
        {
          current: slotSecretOf({ kind: 'password', password }),
          credentialId: passkey.credentialId,
          rpId,
          prfOutput: passkey.prfOutput,
        },
        this.services.signal
      )
    );
  }

  /** A passkey no longer opens the vault; dropping a slot needs no secret. */
  removePasskey(credentialId: TBytes): void {
    this.raiseTo(withoutPasskey(this.current, credentialId));
  }

  /**
   * The slot set of a copy under the same key. Older than the
   * shared base: ignored, so a replayed old file never brings an old password
   * back. The same set: only its epoch is caught up with. Nothing new from
   * them: this device's change goes on, one epoch past theirs. Changed there:
   * merged per kind with this device's own change. The epoch never falls
   * behind a copy's, or the next write would read as a rollback.
   */
  adopt(file: IVaultKeys): void {
    if (file.keyslotsEpoch < this.base.keyslotsEpoch) {
      return;
    }
    this.current = { ...this.current, preserved: file.preserved };
    const { current, base } = this;
    const epoch = Math.max(current.keyslotsEpoch, file.keyslotsEpoch);
    if (sameKeyslots(file.keyslots, current.keyslots)) {
      this.base = file;
      this.raiseTo({ ...current, keyslotsEpoch: epoch });
      return;
    }
    if (sameKeyslots(file.keyslots, base.keyslots)) {
      this.raiseTo({
        ...current,
        keyslotsEpoch: current.keyslotsEpoch > file.keyslotsEpoch ? epoch : epoch + 1,
      });
      return;
    }
    const merged = mergeKeyslots(
      base.keyslots,
      { slots: current.keyslots, epoch: current.keyslotsEpoch },
      { slots: file.keyslots, epoch: file.keyslotsEpoch }
    );
    if (!isNonEmpty(merged)) {
      return;
    }
    const takesTheirs = sameKeyslots(merged, file.keyslots);
    this.base = file;
    this.changedElsewhere = true;
    this.raiseTo({
      ...current,
      keyslots: merged,
      keyslotsEpoch: takesTheirs ? epoch : epoch + 1,
    });
  }

  /** A changed set or epoch is sealed into both copies; an unchanged one is left alone. */
  private raiseTo(keys: IVaultKeys): void {
    if (
      keys.keyslotsEpoch === this.current.keyslotsEpoch &&
      sameKeyslots(keys.keyslots, this.current.keyslots)
    ) {
      return;
    }
    this.current = keys;
    this.services.onChanged();
  }

  /** This set reached a copy: a file older than it is a replay, never a change to merge. */
  shared(keyslotsEpoch: number): void {
    if (this.current.keyslotsEpoch === keyslotsEpoch) {
      this.base = this.current;
    }
  }

  dismissNotice(): void {
    this.changedElsewhere = false;
  }

  /** A set that came in from another device meanwhile wins: this change was made over the older one. */
  private async replace(
    change: (keys: IVaultKeys) => Promise<TResult<IVaultKeys, TCodecError>>
  ): Promise<TUnlockFailure | null> {
    const before = this.current;
    const changed = await change(before);
    if (!changed.ok) {
      return unlockFailureOf(changed.error);
    }
    const { current } = this;
    if (current.keyslots !== before.keyslots || current.keyslotsEpoch !== before.keyslotsEpoch) {
      return 'unavailable';
    }
    runInAction(() => {
      this.current = { ...changed.value, preserved: current.preserved };
    });
    this.services.onChanged();
    return null;
  }
}
