import { err } from '@frozik/utils/result/result';

import type { IGoogleDriveAuth } from '@frozik/vault-app/cloud/domain/ports/google-drive';
import type { IImageCompressor } from '@frozik/vault-app/document/domain/ports/image-compressor';
import type { TReadQrCode } from '@frozik/vault-app/document/domain/ports/qr-reader';
import type { IPasskeys } from '@frozik/vault-app/keys/domain/ports/passkeys';

/**
 * What the first Android release does not have yet, each saying so the way
 * its port allows: the screens then hide or explain the action.
 */
export const NO_PASSKEYS: IPasskeys = {
  rpId: () => '',
  capabilities: () => Promise.resolve({ prf: false, platform: 'fingerprint' }),
  signalUnknown: () => Promise.resolve(),
  create: () => Promise.resolve(err('unsupported')),
  get: () => Promise.resolve(err('unsupported')),
};

export const NO_GOOGLE_SIGN_IN: IGoogleDriveAuth = {
  prepare: () => Promise.resolve(false),
  authorize: () => Promise.resolve(err('unavailable')),
  token: () => Promise.resolve(err({ kind: 'auth-required' })),
  invalidate: () => undefined,
};

export const KEEP_IMAGES_AS_THEY_ARE: IImageCompressor = {
  compress: () => Promise.resolve(null),
};

export const NO_QR_READER: TReadQrCode = () => Promise.resolve(null);
