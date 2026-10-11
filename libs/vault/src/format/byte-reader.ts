import type { TBytes } from '../crypto/bytes';

/**
 * Little-endian reads over a byte range. Callers check `has(length)` first:
 * a read past the end is a parser bug, so it throws instead of returning.
 */
export class ByteReader {
  private offset = 0;
  private readonly view: DataView;
  private readonly bytes: TBytes;

  constructor(bytes: TBytes) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get remaining(): number {
    return this.bytes.length - this.offset;
  }

  has(length: number): boolean {
    return length <= this.remaining;
  }

  u8(): number {
    return this.view.getUint8(this.advance(1));
  }

  u16(): number {
    return this.view.getUint16(this.advance(2), true);
  }

  u32(): number {
    return this.view.getUint32(this.advance(4), true);
  }

  /** `null` above 2^53 — no counter or length of a vault ever gets there honestly. */
  u64(): number | null {
    const value = this.view.getBigUint64(this.advance(8), true);
    return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
  }

  take(length: number): TBytes {
    const start = this.advance(length);
    return this.bytes.slice(start, start + length);
  }

  private advance(length: number): number {
    if (!this.has(length)) {
      throw new RangeError(`Read of ${length} bytes past the end`);
    }
    const start = this.offset;
    this.offset += length;
    return start;
  }
}
