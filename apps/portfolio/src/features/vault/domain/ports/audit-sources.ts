/** Have I Been Pwned's range API: how often a password appears in known breaches. */
export interface IBreachCheck {
  /** `null` when the check could not be made (offline, refused); never sends the password itself. */
  count(password: string, signal: AbortSignal): Promise<number | null>;
}

/** 2FA Directory: the sites that offer one-time codes; `null` when it cannot be had. */
export type TLoadTwoFactorDirectory = (signal: AbortSignal) => Promise<ReadonlySet<string> | null>;
