import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import type { TNonEmptyArray } from '@frozik/utils/types/base';
import { isNil } from 'lodash-es';

import type { TBytes } from '../crypto/bytes';
import { bytesEqual, utf8, utf8Text } from '../crypto/bytes';
import { KEY_ID_BYTES } from '../crypto/dek';
import { KEY_CHECK_BYTES } from '../crypto/hkdf';
import type { TKeyslot } from '../crypto/keyslot';
import { ByteReader } from './byte-reader';
import { ByteWriter } from './byte-writer';
import type { ITlvRecord } from './header-tlv';
import { decodeTlv, encodeTlv } from './header-tlv';
import type { TKeyslotDecodeError } from './keyslot-codec';
import { decodeKeyslot, encodeKeyslot } from './keyslot-codec';

export const VAULT_ID_BYTES = 16;
export const SAVE_SALT_BYTES = 32;
export const DEFAULT_CHUNK_SIZE = 65_536;

const MAGIC = utf8('PWVAULT\0');
const FORMAT_MAJOR = 1;
const FORMAT_MINOR = 0;
const PREAMBLE_BYTES = MAGIC.length + 2 + 2 + 4;
const MAX_HEADER_BYTES = 65_536;
const MIN_CHUNK_SIZE = 1024;
const MAX_CHUNK_SIZE = 16 * 1024 * 1024;
const U32_BYTES = 4;
const U64_BYTES = 8;
/**
 * One password slot and a few others. More is a hostile header:
 * every slot tried costs a KDF run at up to the ceiling.
 */
const MAX_KEYSLOTS = 16;

/** The TLV type codes. */
const TLV = {
  vaultId: 0x01,
  revision: 0x02,
  saveSalt: 0x03,
  chunkSize: 0x04,
  payloadLength: 0x05,
  keyCheck: 0x06,
  keyId: 0x07,
  keyslotsEpoch: 0x08,
  keyslot: 0x09,
  movedTo: 0x0a,
  keyGeneration: 0x0b,
} as const;

const KNOWN_TYPES: ReadonlySet<number> = new Set(Object.values(TLV));

/** Open but authenticated: its SHA-256 is the additional data of every chunk. */
export interface IVaultHeader {
  readonly vaultId: TBytes;
  readonly revision: number;
  readonly saveSalt: TBytes;
  readonly chunkSize: number;
  readonly payloadLength: number;
  readonly keyCheck: TBytes;
  readonly keyId: TBytes;
  readonly keyslotsEpoch: number;
  /**
   * How many rotations the key is past the vault's first:
   * authenticated, so a file under an earlier key cannot claim a later one.
   */
  readonly keyGeneration: number;
  readonly keyslots: TNonEmptyArray<TKeyslot>;
  readonly movedTo: string | null;
  /** Skippable records of a newer minor version, written back as they came. */
  readonly preserved: readonly ITlvRecord[];
}

export type THeaderDecodeError = TKeyslotDecodeError;

export interface IDecodedHeader {
  readonly header: IVaultHeader;
  readonly headerBytes: TBytes;
}

function u32Value(value: number): TBytes {
  return new ByteWriter().u32(value).toBytes();
}

function u64Value(value: number): TBytes {
  return new ByteWriter().u64(value).toBytes();
}

function record(type: number, value: TBytes): ITlvRecord {
  return { type, skippable: false, value };
}

export function encodeHeader(header: IVaultHeader): TBytes {
  const records: ITlvRecord[] = [
    record(TLV.vaultId, header.vaultId),
    record(TLV.revision, u64Value(header.revision)),
    record(TLV.saveSalt, header.saveSalt),
    record(TLV.chunkSize, u32Value(header.chunkSize)),
    record(TLV.payloadLength, u64Value(header.payloadLength)),
    record(TLV.keyCheck, header.keyCheck),
    record(TLV.keyId, header.keyId),
    record(TLV.keyslotsEpoch, u64Value(header.keyslotsEpoch)),
    ...header.keyslots.map(slot => record(TLV.keyslot, encodeKeyslot(slot))),
    ...(isNil(header.movedTo) ? [] : [record(TLV.movedTo, utf8(header.movedTo))]),
    ...(header.keyGeneration === 0
      ? []
      : [{ type: TLV.keyGeneration, skippable: true, value: u64Value(header.keyGeneration) }]),
    ...header.preserved,
  ];
  const body = encodeTlv(records);
  return new ByteWriter()
    .bytes(MAGIC)
    .u16(FORMAT_MAJOR)
    .u16(FORMAT_MINOR)
    .u32(PREAMBLE_BYTES + body.length)
    .bytes(body)
    .toBytes();
}

/** Every `.pwv`, of any version, starts with the magic: how an import tells it from other files. */
export function startsWithVaultMagic(file: Uint8Array): boolean {
  return bytesEqual(file.subarray(0, MAGIC.length), MAGIC);
}

/** The header region of a file: its length is known before the TLVs are read. */
function sliceHeader(file: TBytes): TResult<TBytes, THeaderDecodeError> {
  const reader = new ByteReader(file);
  if (!reader.has(PREAMBLE_BYTES) || !bytesEqual(reader.take(MAGIC.length), MAGIC)) {
    return err('unsupported-format');
  }
  if (reader.u16() !== FORMAT_MAJOR) {
    return err('unsupported-format');
  }
  reader.u16();
  const length = reader.u32();
  if (length < PREAMBLE_BYTES || length > MAX_HEADER_BYTES || length > file.length) {
    return err('corrupted');
  }
  return ok(file.slice(0, length));
}

interface IGroupedRecords {
  readonly byType: ReadonlyMap<number, TBytes>;
  readonly slots: readonly TBytes[];
  readonly preserved: readonly ITlvRecord[];
}

function groupRecords(
  records: readonly ITlvRecord[]
): TResult<IGroupedRecords, THeaderDecodeError> {
  const byType = new Map<number, TBytes>();
  const slots: TBytes[] = [];
  const preserved: ITlvRecord[] = [];
  for (const entry of records) {
    if (!KNOWN_TYPES.has(entry.type)) {
      if (!entry.skippable) {
        return err('unsupported-format');
      }
      preserved.push(entry);
    } else if (entry.type === TLV.keyslot) {
      slots.push(entry.value);
    } else if (byType.has(entry.type)) {
      return err('corrupted');
    } else {
      byType.set(entry.type, entry.value);
    }
  }
  return ok({ byType, slots, preserved });
}

function fixed(byType: ReadonlyMap<number, TBytes>, type: number, length: number): TBytes | null {
  const value = byType.get(type);
  return value?.length === length ? value : null;
}

function readU64(value: TBytes | null): number | null {
  return isNil(value) ? null : new ByteReader(value).u64();
}

function decodeKeyslots(
  values: readonly TBytes[]
): TResult<TNonEmptyArray<TKeyslot>, THeaderDecodeError> {
  const slots: TKeyslot[] = [];
  for (const value of values) {
    const slot = decodeKeyslot(value);
    if (!slot.ok) {
      return slot;
    }
    slots.push(slot.value);
  }
  const [first, ...rest] = slots;
  const passwordSlots = slots.filter(slot => slot.kind === 'password').length;
  if (passwordSlots > 1 || slots.length > MAX_KEYSLOTS) {
    return err('unsupported-format');
  }
  return !isNil(first) && passwordSlots === 1 ? ok([first, ...rest]) : err('corrupted');
}

function decodeMovedTo(value: TBytes | undefined): TResult<string | null, 'corrupted'> {
  if (isNil(value)) {
    return ok(null);
  }
  const text = utf8Text(value);
  return isNil(text) ? err('corrupted') : ok(text);
}

type THeaderFields = Omit<IVaultHeader, 'keyslots' | 'preserved'>;

function decodeFields(
  byType: ReadonlyMap<number, TBytes>
): TResult<THeaderFields, THeaderDecodeError> {
  const vaultId = fixed(byType, TLV.vaultId, VAULT_ID_BYTES);
  const revision = readU64(fixed(byType, TLV.revision, U64_BYTES));
  const saveSalt = fixed(byType, TLV.saveSalt, SAVE_SALT_BYTES);
  const chunkSizeBytes = fixed(byType, TLV.chunkSize, U32_BYTES);
  const payloadLength = readU64(fixed(byType, TLV.payloadLength, U64_BYTES));
  const keyCheck = fixed(byType, TLV.keyCheck, KEY_CHECK_BYTES);
  const keyId = fixed(byType, TLV.keyId, KEY_ID_BYTES);
  const keyslotsEpoch = readU64(fixed(byType, TLV.keyslotsEpoch, U64_BYTES));
  const movedTo = decodeMovedTo(byType.get(TLV.movedTo));
  const keyGeneration = byType.has(TLV.keyGeneration)
    ? readU64(fixed(byType, TLV.keyGeneration, U64_BYTES))
    : 0;
  if (
    isNil(vaultId) ||
    isNil(revision) ||
    isNil(saveSalt) ||
    isNil(chunkSizeBytes) ||
    isNil(payloadLength) ||
    isNil(keyCheck) ||
    isNil(keyId) ||
    isNil(keyslotsEpoch) ||
    isNil(keyGeneration) ||
    !movedTo.ok
  ) {
    return err('corrupted');
  }
  const chunkSize = new ByteReader(chunkSizeBytes).u32();
  if (chunkSize < MIN_CHUNK_SIZE || chunkSize > MAX_CHUNK_SIZE) {
    return err('unsupported-format');
  }
  return ok({
    vaultId,
    revision,
    saveSalt,
    chunkSize,
    payloadLength,
    keyCheck,
    keyId,
    keyslotsEpoch,
    keyGeneration,
    movedTo: movedTo.value,
  });
}

export function decodeHeader(file: TBytes): TResult<IDecodedHeader, THeaderDecodeError> {
  const headerBytes = sliceHeader(file);
  if (!headerBytes.ok) {
    return headerBytes;
  }
  const records = decodeTlv(headerBytes.value.slice(PREAMBLE_BYTES));
  if (!records.ok) {
    return records;
  }
  const grouped = groupRecords(records.value);
  if (!grouped.ok) {
    return grouped;
  }
  const keyslots = decodeKeyslots(grouped.value.slots);
  if (!keyslots.ok) {
    return keyslots;
  }
  const fields = decodeFields(grouped.value.byType);
  if (!fields.ok) {
    return fields;
  }
  return ok({
    headerBytes: headerBytes.value,
    header: { ...fields.value, keyslots: keyslots.value, preserved: grouped.value.preserved },
  });
}
