import { err } from '@frozik/utils/result/result';

import type { IImageCompressor } from '@frozik/vault-app/document/domain/ports/image-compressor';
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

export const KEEP_IMAGES_AS_THEY_ARE: IImageCompressor = {
  compress: () => Promise.resolve(null),
};
