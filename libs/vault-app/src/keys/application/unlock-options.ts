import { isNil } from 'lodash-es';

import type { TLifecycleState } from '../../session/domain/lifecycle-state';
import type { IEnrolments, TCredentialKind } from '../domain/credentials-offered';
import { credentialsOffered } from '../domain/credentials-offered';

export interface IUnlockOptions {
  readonly credentials: readonly TCredentialKind[];
  /** The quick code's one try failed: the screen says why the master password is asked. */
  readonly afterFailedQuickCode: boolean;
}

/** What the unlock screen offers for the lock in force, or `null` when nothing is locked. */
export function unlockOptionsOf(
  lifecycle: TLifecycleState,
  enrolments: IEnrolments
): IUnlockOptions | null {
  const lock =
    lifecycle.kind === 'locked'
      ? lifecycle
      : lifecycle.kind === 'unlocking'
        ? lifecycle.from
        : null;
  return isNil(lock)
    ? null
    : {
        credentials: credentialsOffered(lock, enrolments),
        afterFailedQuickCode: lock.reason === 'quick-unlock-failed',
      };
}
