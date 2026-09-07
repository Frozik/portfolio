const INITIAL_CAPACITY = 1 << 16;

function zigzag(value: number): number {
  return value >= 0 ? value * 2 : -value * 2 - 1;
}

function unzigzag(value: number): number {
  return value % 2 === 0 ? value / 2 : -(value + 1) / 2;
}

/** Growable little-endian byte sink with LEB128 varints; numbers stay within 2^53. */
export class ByteWriter {
  private buffer = new Uint8Array(INITIAL_CAPACITY);
  private length = 0;

  writeUint8(value: number): void {
    this.ensure(1);
    this.buffer[this.length++] = value & 0xff;
  }

  writeUint32(value: number): void {
    this.ensure(4);
    new DataView(this.buffer.buffer).setUint32(this.length, value >>> 0, true);
    this.length += 4;
  }

  writeVarint(value: number): void {
    if (value < 0 || !Number.isInteger(value)) {
      throw new RangeError(`varint must be a non-negative integer, got ${value}`);
    }
    this.ensure(10);
    let remaining = value;
    while (remaining >= 0x80) {
      this.buffer[this.length++] = (remaining % 0x80) | 0x80;
      remaining = Math.floor(remaining / 0x80);
    }
    this.buffer[this.length++] = remaining;
  }

  writeSignedVarint(value: number): void {
    this.writeVarint(zigzag(value));
  }

  writeBytes(bytes: Uint8Array): void {
    this.ensure(bytes.length);
    this.buffer.set(bytes, this.length);
    this.length += bytes.length;
  }

  toBytes(): Uint8Array {
    return this.buffer.slice(0, this.length);
  }

  private ensure(extra: number): void {
    if (this.length + extra <= this.buffer.length) {
      return;
    }
    let capacity = this.buffer.length * 2;
    while (capacity < this.length + extra) {
      capacity *= 2;
    }
    const grown = new Uint8Array(capacity);
    grown.set(this.buffer);
    this.buffer = grown;
  }
}

export class ByteReader {
  private offset = 0;
  private readonly view: DataView;

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get position(): number {
    return this.offset;
  }

  get remaining(): number {
    return this.bytes.length - this.offset;
  }

  readUint8(): number {
    this.guard(1);
    return this.bytes[this.offset++];
  }

  readUint32(): number {
    this.guard(4);
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readVarint(): number {
    let result = 0;
    let multiplier = 1;
    for (let index = 0; index < 10; index++) {
      const byte = this.readUint8();
      result += (byte & 0x7f) * multiplier;
      if (byte < 0x80) {
        return result;
      }
      multiplier *= 0x80;
    }
    throw new RangeError('varint longer than 10 bytes');
  }

  readSignedVarint(): number {
    return unzigzag(this.readVarint());
  }

  readBytes(length: number): Uint8Array {
    this.guard(length);
    const slice = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }

  private guard(length: number): void {
    if (this.offset + length > this.bytes.length) {
      throw new RangeError('pack truncated');
    }
  }
}
