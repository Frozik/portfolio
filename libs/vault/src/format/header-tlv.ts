import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';

import type { TBytes } from '../crypto/bytes';
import { ByteReader } from './byte-reader';
import { ByteWriter } from './byte-writer';

/** `type u8 | flags u8 | len u16 | value[len]`; flag bit 0 = "skip me if unknown". */
export interface ITlvRecord {
  readonly type: number;
  readonly skippable: boolean;
  readonly value: TBytes;
}

const SKIPPABLE_FLAG = 0b1;
const RECORD_HEAD_BYTES = 4;

export function encodeTlv(records: readonly ITlvRecord[]): TBytes {
  const writer = new ByteWriter();
  for (const { type, skippable, value } of records) {
    writer
      .u8(type)
      .u8(skippable ? SKIPPABLE_FLAG : 0)
      .u16(value.length)
      .bytes(value);
  }
  return writer.toBytes();
}

export function decodeTlv(bytes: TBytes): TResult<readonly ITlvRecord[], 'corrupted'> {
  const reader = new ByteReader(bytes);
  const records: ITlvRecord[] = [];
  while (reader.remaining > 0) {
    if (!reader.has(RECORD_HEAD_BYTES)) {
      return err('corrupted');
    }
    const type = reader.u8();
    const skippable = (reader.u8() & SKIPPABLE_FLAG) !== 0;
    const length = reader.u16();
    if (!reader.has(length)) {
      return err('corrupted');
    }
    records.push({ type, skippable, value: reader.take(length) });
  }
  return ok(records);
}
