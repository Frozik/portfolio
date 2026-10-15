import type { TLockLevel, TLockReason } from '../../session/domain/lifecycle-state';

/** A way back into a locked vault, as the unlock screen offers it. */
export type TCredentialKind = 'quick-code' | 'password' | 'recovery-key' | 'passkey' | 'biometric';

/** What this device has set up beyond the master password. */
export interface IEnrolments {
  /** A passkey of this site opens the vault (the web). */
  readonly passkey: boolean;
  /** The platform's biometric unlock is enrolled (Android). */
  readonly biometric: boolean;
}

/**
 * A quick lock offers its code first, then what else this device has; a full
 * lock offers the credentials. After a failed quick code only the master
 * password and the recovery key are left until the master password is typed.
 */
export function credentialsOffered(
  lock: { readonly level: TLockLevel; readonly reason: TLockReason | null },
  enrolments: IEnrolments
): readonly TCredentialKind[] {
  const always: readonly TCredentialKind[] = ['password', 'recovery-key'];
  if (lock.reason === 'quick-unlock-failed') {
    return always;
  }
  const extra: readonly TCredentialKind[] = [
    ...(enrolments.biometric ? (['biometric'] as const) : []),
    ...(enrolments.passkey ? (['passkey'] as const) : []),
  ];
  return lock.level === 'quick' ? ['quick-code', ...extra, ...always] : [...extra, ...always];
}
