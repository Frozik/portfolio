import type { TBytes } from '../crypto/bytes';
import { sealSafeInCloudDb } from '../export/safeincloud/seal-safeincloud-db';
import { createSeededRandom } from './seeded-random';

const SEED = 7;

/** A SafeInCloud database sealed from this XML with this password, as the export writes one. */
export function aSafeInCloudDb(xml: string, password: string): Promise<TBytes> {
  return sealSafeInCloudDb(xml, password, createSeededRandom(SEED));
}
