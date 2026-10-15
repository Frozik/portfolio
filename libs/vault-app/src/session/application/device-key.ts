import { assertNever } from '@frozik/utils/assert/assertNever';
import type { TResult } from '@frozik/utils/result/result';
import { err } from '@frozik/utils/result/result';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import type { TUnlockFailure } from '@frozik/vault/session/unlock-failure';
import { isNil } from 'lodash-es';

import type { IDeviceUnlock } from '../../keys/domain/ports/device-unlock';
import type { IVaultOpeningServices } from '../../sync/application/vault-opening';
import { openVault } from '../../sync/application/vault-opening';
import type { ICustodyKey } from '../domain/ports/key-custody';
import type { IOpenedSession } from './vault-session-inputs';

/**
 * The key the platform's biometrics release. A key a new enrolment made
 * useless is forgotten here, so the next unlock no longer offers it.
 */
async function keyFromDevice(
  deviceUnlock: IDeviceUnlock | null,
  vaultKey: TVaultKey
): Promise<TResult<ICustodyKey, TUnlockFailure> | 'cancelled'> {
  if (isNil(deviceUnlock)) {
    return err('unavailable');
  }
  const released = await deviceUnlock.unlock(vaultKey);
  if (released.ok) {
    return released;
  }
  switch (released.error) {
    case 'cancelled':
      return 'cancelled';
    case 'invalidated':
      await deviceUnlock.forget(vaultKey);
      return err('biometric-invalidated');
    case 'unavailable':
      return err('unavailable');
    default:
      return assertNever(released.error);
  }
}

/**
 * The vault opened with the key the biometrics release. A key the file no
 * longer takes (the vault's key was rotated) is as useless as an invalidated
 * one: forgotten, and the unlock says so.
 */
export async function openWithDevice(
  services: IVaultOpeningServices & { readonly deviceUnlock: IDeviceUnlock | null },
  vaultKey: TVaultKey,
  signal: AbortSignal
): Promise<TResult<IOpenedSession, TUnlockFailure> | 'cancelled'> {
  const key = await keyFromDevice(services.deviceUnlock, vaultKey);
  if (key === 'cancelled' || !key.ok) {
    return key;
  }
  const opened = await openVault(services, vaultKey, { kind: 'session', ...key.value }, signal);
  if (!opened.ok && opened.error === 'biometric-invalidated') {
    await services.deviceUnlock?.forget(vaultKey);
  }
  return opened;
}
