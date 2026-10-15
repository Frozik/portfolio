import { assert } from '@frozik/utils/assert/assert';

import type { TBytes } from '../crypto/bytes';
import { ByteReader } from '../format/byte-reader';
import { ByteWriter } from '../format/byte-writer';
import type { ITlvRecord } from '../format/header-tlv';
import { decodeTlv, encodeTlv } from '../format/header-tlv';

const MAGIC_BYTES = 8;
const PREAMBLE_BYTES = MAGIC_BYTES + 2 + 2 + 4;
const FORMAT_MAJOR = 1;

/** The header records format 1.0 reads; any other record must be skippable for it to open the file. */
export const FORMAT_V1_0_RECORD_TYPES: ReadonlySet<number> = new Set([
  0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
]);
export const FORMAT_V1_0_KEYSLOT_TYPE = 0x09;

interface IHeaderLayout {
  readonly preamble: TBytes;
  readonly major: number;
  readonly records: readonly ITlvRecord[];
}

function layoutOf(file: TBytes): IHeaderLayout {
  const reader = new ByteReader(file);
  const magic = reader.take(MAGIC_BYTES);
  const major = reader.u16();
  reader.u16();
  const length = reader.u32();
  const records = decodeTlv(file.slice(PREAMBLE_BYTES, length));
  assert(records.ok, 'not a vault header');
  return { preamble: magic, major, records: records.value };
}

/** What a 1.0 reader refuses a header for: another major version, or a record it cannot skip. */
export function isReadableByFormatV1_0(file: TBytes): boolean {
  const { major, records } = layoutOf(file);
  return (
    major === FORMAT_MAJOR &&
    records.every(record => FORMAT_V1_0_RECORD_TYPES.has(record.type) || record.skippable)
  );
}

function headerOf(preamble: TBytes, records: readonly ITlvRecord[]): TBytes {
  const body = encodeTlv(records);
  return new ByteWriter()
    .bytes(preamble)
    .u16(FORMAT_MAJOR)
    .u16(0)
    .u32(PREAMBLE_BYTES + body.length)
    .bytes(body)
    .toBytes();
}

/**
 * A header as a 1.0 client saves it, after its own edit of the records it
 * knows: 1.0 seals only what it knows, so every newer record is gone.
 */
export function savedByFormatV1_0(
  file: TBytes,
  edit: (known: readonly ITlvRecord[]) => readonly ITlvRecord[] = known => known
): TBytes {
  const { preamble, records } = layoutOf(file);
  return headerOf(
    preamble,
    edit(records.filter(record => FORMAT_V1_0_RECORD_TYPES.has(record.type)))
  );
}
