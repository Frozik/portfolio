import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import { toBase64Url } from '@frozik/vault/crypto/bytes';
import { isNil } from 'lodash-es';

import type {
  IPasskeyAnswer,
  IPasskeys,
  TPasskeyFailure,
} from '@frozik/vault-app/keys/domain/ports/passkeys';

import { platformAuthenticatorOf } from './platform-authenticator';

const RP_NAME = 'Password vault';
const USER_ID_BYTES = 16;
const CHALLENGE_BYTES = 32;
/** ES256 and RS256: what platform authenticators and security keys offer between them. */
const ALGORITHMS = [-7, -257] as const;

function currentSite(): string {
  return window.location.hostname;
}

/** The vault checks no signature — the PRF output is what it needs — so the challenge only has to be fresh. */
function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length));
}

function failureOf(error: unknown): TPasskeyFailure {
  return error instanceof DOMException && error.name === 'NotAllowedError' ? 'cancelled' : 'failed';
}

function prfOutputOf(credential: Credential | null): Uint8Array<ArrayBuffer> | null {
  if (!(credential instanceof PublicKeyCredential)) {
    return null;
  }
  const first = credential.getClientExtensionResults().prf?.results?.first;
  if (isNil(first)) {
    return null;
  }
  const original = ArrayBuffer.isView(first)
    ? new Uint8Array(first.buffer, first.byteOffset, first.byteLength)
    : new Uint8Array(first);
  const copy = original.slice();
  original.fill(0);
  return copy;
}

async function evaluate(
  credentialIds: readonly Uint8Array<ArrayBuffer>[],
  salt: Uint8Array<ArrayBuffer>
): Promise<TResult<IPasskeyAnswer, TPasskeyFailure>> {
  try {
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(CHALLENGE_BYTES),
        rpId: currentSite(),
        allowCredentials: credentialIds.map(id => ({ type: 'public-key', id })),
        userVerification: 'required',
        extensions: { prf: { eval: { first: salt } } },
      },
    });
    const prfOutput = prfOutputOf(credential);
    if (!(credential instanceof PublicKeyCredential) || isNil(prfOutput)) {
      return err('no-prf');
    }
    return ok({ credentialId: new Uint8Array(credential.rawId), prfOutput });
  } catch (error) {
    return err(failureOf(error));
  }
}

/** WebAuthn with the PRF extension; a passkey that answers no PRF at creation is asked once more. */
export const WEBAUTHN_PASSKEYS: IPasskeys = {
  rpId: currentSite,
  async capabilities() {
    const platform = platformAuthenticatorOf(navigator.userAgent);
    if (typeof PublicKeyCredential === 'undefined') {
      return { prf: false, platform };
    }
    const capabilities = await PublicKeyCredential.getClientCapabilities?.();
    return { prf: capabilities?.['extension:prf'] !== false, platform };
  },
  async signalUnknown(credentialId) {
    await PublicKeyCredential.signalUnknownCredential?.({
      rpId: currentSite(),
      credentialId: toBase64Url(credentialId),
    });
  },
  async create({ vaultName, salt }) {
    if (typeof PublicKeyCredential === 'undefined') {
      return err('unsupported');
    }
    try {
      const credential = await navigator.credentials.create({
        publicKey: {
          rp: { name: RP_NAME, id: currentSite() },
          user: { id: randomBytes(USER_ID_BYTES), name: vaultName, displayName: vaultName },
          challenge: randomBytes(CHALLENGE_BYTES),
          pubKeyCredParams: ALGORITHMS.map(alg => ({ type: 'public-key', alg })),
          authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
          extensions: { prf: { eval: { first: salt } } },
        },
      });
      if (!(credential instanceof PublicKeyCredential)) {
        return err('failed');
      }
      const prfOutput = prfOutputOf(credential);
      if (!isNil(prfOutput)) {
        return ok({ credentialId: new Uint8Array(credential.rawId), prfOutput });
      }
      return credential.getClientExtensionResults().prf?.enabled === true
        ? evaluate([new Uint8Array(credential.rawId)], salt)
        : err('no-prf');
    } catch (error) {
      return err(failureOf(error));
    }
  },
  get: ({ credentialIds, salt }) => evaluate(credentialIds, salt),
};
