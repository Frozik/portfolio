import type { Milliseconds } from '@frozik/utils/date/types';
import type { TResult } from '@frozik/utils/result/result';
import { err } from '@frozik/utils/result/result';
import type { TUnlockFailure } from '@frozik/vault/session/unlock-failure';

import type { VaultRegistryModel } from '../../device/application/VaultRegistryModel';
import type { IOpenedSession } from './vault-session-inputs';

/** A new vault joins this device's list before its session starts; one the list refuses is unavailable. */
export async function listedOnDevice(
  registry: VaultRegistryModel,
  created: TResult<IOpenedSession, TUnlockFailure>,
  at: Milliseconds
): Promise<TResult<IOpenedSession, TUnlockFailure>> {
  if (!created.ok) {
    return created;
  }
  const { vaultKey, document } = created.value;
  return (await registry.addNew(vaultKey, document.settings, at)) ? created : err('unavailable');
}
