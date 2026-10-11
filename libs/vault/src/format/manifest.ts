import { parseJson } from '@frozik/utils/parseJson';
import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import { isNil } from 'lodash-es';
import { z } from 'zod';

import type { TBytes } from '../crypto/bytes';
import { utf8, utf8Text } from '../crypto/bytes';

export const MANIFEST_PATH = 'manifest.json';

/** The document schema this build reads and writes; a newer one opens read-only. */
export const CURRENT_SCHEMA_VERSION = 1;

const MANIFEST_SCHEMA = z.looseObject({
  format: z.literal('pwv'),
  schemaVersion: z.int().min(1),
  createdAt: z.iso.datetime({ offset: true }),
  createdBy: z.string(),
});

/** Unknown keys of a newer writer are kept and written back. */
export type TManifest = z.infer<typeof MANIFEST_SCHEMA>;

export function encodeManifest(manifest: TManifest): TBytes {
  return utf8(JSON.stringify(manifest));
}

export function decodeManifest(bytes: TBytes | undefined): TResult<TManifest, 'corrupted'> {
  const text = isNil(bytes) ? null : utf8Text(bytes);
  const parsed = MANIFEST_SCHEMA.safeParse(parseJson<unknown>(text));
  return parsed.success ? ok(parsed.data) : err('corrupted');
}
