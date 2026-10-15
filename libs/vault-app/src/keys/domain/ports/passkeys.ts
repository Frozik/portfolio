import type { TResult } from '@frozik/utils/result/result';

/** A passkey answered: which credential, and its PRF output for the vault's salt — the secret its slot needs. */
export interface IPasskeyAnswer {
  readonly credentialId: Uint8Array<ArrayBuffer>;
  readonly prfOutput: Uint8Array<ArrayBuffer>;
}

export type TPasskeyFailure =
  /** No WebAuthn here at all. */
  | 'unsupported'
  /** The user closed the browser's prompt, or chose no passkey. */
  | 'cancelled'
  /** The authenticator made the passkey but has no PRF: it cannot open a vault. */
  | 'no-prf'
  | 'failed';

/**
 * A passkey as the convenient unlock: the WebAuthn PRF
 * extension yields a per-credential secret for the vault's salt. Both calls
 * must come synchronously from a click: the prompt opens there or not at all.
 */
/** The authenticator this platform offers, so the button can name it. */
export type TPlatformAuthenticator =
  | 'face-id'
  | 'touch-id'
  | 'windows-hello'
  | 'fingerprint'
  | 'passkey';

export interface IPasskeyCapabilities {
  /** The browser can ask a passkey for a PRF secret: without it a passkey cannot open a vault. */
  readonly prf: boolean;
  readonly platform: TPlatformAuthenticator;
}

export interface IPasskeys {
  /** The site passkeys are made and asked for on: one made elsewhere cannot answer here. */
  rpId(): string;
  capabilities(): Promise<IPasskeyCapabilities>;
  /** This site's passkey no longer opens anything here: its authenticator may hide or delete it. */
  signalUnknown(credentialId: Uint8Array<ArrayBuffer>): Promise<void>;
  create(request: {
    readonly vaultName: string;
    readonly salt: Uint8Array<ArrayBuffer>;
  }): Promise<TResult<IPasskeyAnswer, TPasskeyFailure>>;
  get(request: {
    readonly credentialIds: readonly Uint8Array<ArrayBuffer>[];
    readonly salt: Uint8Array<ArrayBuffer>;
  }): Promise<TResult<IPasskeyAnswer, TPasskeyFailure>>;
}
