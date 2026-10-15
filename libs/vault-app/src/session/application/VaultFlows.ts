import type { IStorageProvider } from '@frozik/cloud-storage/core/storage-provider';
import type { TResult } from '@frozik/utils/result/result';
import type { IVaultCodec } from '@frozik/vault/codec/vault-codec';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import type { IRandom } from '@frozik/vault/ports/random';
import { passkeySalt, passkeysOf } from '@frozik/vault/session/passkeys-of';
import { isNil } from 'lodash-es';

import type { TReadQrCode } from '../../document/domain/ports/qr-reader';
import type { TSaveFile } from '../../interchange/domain/ports/file-saver';
import type { TReadKdbx } from '../../interchange/domain/ports/kdbx-reader';
import type { IDeviceUnlock } from '../../keys/domain/ports/device-unlock';
import type {
  IPasskeyAnswer,
  IPasskeyCapabilities,
  TPasskeyFailure,
} from '../../keys/domain/ports/passkeys';
import type { IPasskeys } from '../../keys/domain/ports/passkeys';
import { LOCAL_COPY_PATH } from '../../sync/domain/local-copy';
import type { IAppIdentity } from '../domain/ports/app-identity';
import type { IQuickKeep } from '../domain/ports/quick-keep';
import type { ISessionClock } from '../domain/ports/session-clock';

export interface IVaultFlowServices {
  readonly codec: IVaultCodec;
  readonly random: IRandom;
  readonly clock: ISessionClock;
  readonly readQrCode: TReadQrCode;
  readonly readKdbx: TReadKdbx;
  readonly saveFile: TSaveFile;
  readonly passkeys: IPasskeys;
  readonly identity: IAppIdentity;
  readonly localCopyOf: (vaultKey: TVaultKey) => IStorageProvider;
  readonly deviceUnlock: IDeviceUnlock | null;
  readonly quickKeep?: IQuickKeep;
}

/** What a locked vault's screen asks before any key: the passkeys it may open with. */
export interface IVaultFlows {
  /** The passkeys of this site a locked vault opens with, from its local copy's plaintext header. */
  passkeysOfLocked(vaultKey: TVaultKey): Promise<readonly TBytes[]>;
  /** Whether this browser can open a vault with a passkey, and what its authenticator is called. */
  passkeyCapabilities(): Promise<IPasskeyCapabilities>;
  /** The passkey's answer for this vault's salt; must start within the click that asked. */
  passkeyAnswer(
    vaultKey: TVaultKey,
    credentialIds: readonly TBytes[]
  ): Promise<TResult<IPasskeyAnswer, TPasskeyFailure>>;
  /** Whether this phone's strong biometrics hold this vault's key. */
  deviceUnlockOffered(vaultKey: TVaultKey): Promise<boolean>;
}

/** `signal` ends with the app: a read still running then gives nothing. */
export function createVaultFlows(services: IVaultFlowServices, signal: AbortSignal): IVaultFlows {
  return {
    passkeyCapabilities: () => services.passkeys.capabilities(),
    passkeyAnswer: (vaultKey, credentialIds) =>
      services.passkeys.get({ credentialIds, salt: passkeySalt(vaultKey) }),
    deviceUnlockOffered: async vaultKey => {
      const { deviceUnlock } = services;
      return (
        !isNil(deviceUnlock) &&
        (await deviceUnlock.available()) === 'strong' &&
        (await deviceUnlock.isEnrolled(vaultKey))
      );
    },
    passkeysOfLocked: async vaultKey => {
      const read = await services.localCopyOf(vaultKey).read(LOCAL_COPY_PATH, signal);
      return read.ok && !isNil(read.value)
        ? passkeysOf(read.value.bytes, services.passkeys.rpId())
        : [];
    },
  };
}
