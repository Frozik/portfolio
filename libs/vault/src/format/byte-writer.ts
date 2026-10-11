import type { TBytes } from '../crypto/bytes';
import { concatBytes } from '../crypto/bytes';

/** Little-endian writes, collected and joined once at the end. */
export class ByteWriter {
  private readonly parts: Uint8Array[] = [];

  u8(value: number): this {
    return this.fixed(1, view => view.setUint8(0, value));
  }

  u16(value: number): this {
    return this.fixed(2, view => view.setUint16(0, value, true));
  }

  u32(value: number): this {
    return this.fixed(4, view => view.setUint32(0, value, true));
  }

  u64(value: number): this {
    return this.fixed(8, view => view.setBigUint64(0, BigInt(value), true));
  }

  bytes(value: Uint8Array): this {
    this.parts.push(value);
    return this;
  }

  toBytes(): TBytes {
    return concatBytes(...this.parts);
  }

  private fixed(length: number, write: (view: DataView) => void): this {
    const part = new Uint8Array(length);
    write(new DataView(part.buffer));
    this.parts.push(part);
    return this;
  }
}
