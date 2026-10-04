const POLYNOMIAL = 0xedb88320;
const BITS_PER_BYTE = 8;
const BYTE_VALUES = 256;
const ALL_ONES = 0xffffffff;

const TABLE = Uint32Array.from({ length: BYTE_VALUES }, (_, byte) => {
  let value = byte;
  for (let bit = 0; bit < BITS_PER_BYTE; bit += 1) {
    value = value & 1 ? POLYNOMIAL ^ (value >>> 1) : value >>> 1;
  }
  return value;
});

/** Incremental CRC-32 (IEEE, as in zip and PNG): feed chunks in order, read `value` at any point. */
export class Crc32 {
  private state = ALL_ONES;

  update(bytes: Uint8Array): void {
    let state = this.state;
    for (const byte of bytes) {
      state = (TABLE[(state ^ byte) & 0xff] ?? 0) ^ (state >>> BITS_PER_BYTE);
    }
    this.state = state;
  }

  get value(): number {
    return (this.state ^ ALL_ONES) >>> 0;
  }
}
