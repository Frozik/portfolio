import type { IRandom } from '../ports/random';
import type { TBytes } from './bytes';

/** The platform CSPRNG. */
export const WEB_RANDOM: IRandom = {
  bytes: (length: number): TBytes => crypto.getRandomValues(new Uint8Array(length)),
};
