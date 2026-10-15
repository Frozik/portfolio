import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import { isNil } from 'lodash-es';

import type { TBytes } from '../crypto/bytes';
import { toHex, utf8, utf8Text } from '../crypto/bytes';
import type { TKeyslot } from '../crypto/keyslot';
import { ByteReader } from './byte-reader';
import { ByteWriter } from './byte-writer';

const LENGTH_BYTES = 2;

/** Which site each passkey belongs to, keyed by the hex credential id. */
export type TPasskeySites = ReadonlyMap<string, string>;

/** `credentialId len u16 | credentialId | rpId len u16 | rpId utf8`, one entry per passkey of a known site. */
export function encodePasskeySites(slots: readonly TKeyslot[]): TBytes | null {
  const sited = slots.flatMap(slot =>
    slot.kind === 'prf' && !isNil(slot.rpId) ? [{ ...slot, rpId: slot.rpId }] : []
  );
  if (sited.length === 0) {
    return null;
  }
  const writer = new ByteWriter();
  for (const { credentialId, rpId } of sited) {
    const site = utf8(rpId);
    writer.u16(credentialId.length).bytes(credentialId).u16(site.length).bytes(site);
  }
  return writer.toBytes();
}

function readSized(reader: ByteReader): TBytes | null {
  if (!reader.has(LENGTH_BYTES)) {
    return null;
  }
  const length = reader.u16();
  return reader.has(length) ? reader.take(length) : null;
}

export function decodePasskeySites(value: TBytes): TResult<TPasskeySites, 'corrupted'> {
  const reader = new ByteReader(value);
  const sites = new Map<string, string>();
  while (reader.remaining > 0) {
    const credentialId = readSized(reader);
    const site = readSized(reader);
    const rpId = isNil(site) ? null : utf8Text(site);
    if (isNil(credentialId) || isNil(rpId)) {
      return err('corrupted');
    }
    sites.set(toHex(credentialId), rpId);
  }
  return ok(sites);
}

export function passkeySiteOf(sites: TPasskeySites, credentialId: TBytes): string | null {
  return sites.get(toHex(credentialId)) ?? null;
}
