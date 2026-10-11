import type { TKeyRotationFailure } from '../../application/KeyRotation';
import { vaultT } from '../translations';
import { keysT } from '../translations/keys';

export function rotationFailureText(failure: TKeyRotationFailure): string {
  switch (failure) {
    case 'not-synced':
    case 'changed-meanwhile':
    case 'rollback-security':
      return keysT.rotation.failures[failure];
    default:
      return vaultT.unlock.failures[failure];
  }
}
