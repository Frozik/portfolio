/**
 * Bytes received in chunks of whatever size the peer chose. Each byte is
 * copied once, when it is taken out — never re-concatenated per arrival, so a
 * peer that trickles one byte at a time costs linear, not quadratic, work.
 */
export class ByteQueue {
  private readonly chunks: Uint8Array[] = [];
  private headOffset = 0;
  private size = 0;

  get length(): number {
    return this.size;
  }

  push(bytes: Uint8Array): void {
    if (bytes.byteLength > 0) {
      this.chunks.push(bytes);
      this.size += bytes.byteLength;
    }
  }

  /** Copies the first `count` bytes without consuming them. */
  peek(count: number): Uint8Array {
    return this.copy(count, false);
  }

  /** Removes and returns the first `count` bytes. */
  take(count: number): Uint8Array {
    return this.copy(count, true);
  }

  private copy(count: number, consume: boolean): Uint8Array {
    const result = new Uint8Array(count);
    let written = 0;
    let chunkIndex = 0;
    let offset = this.headOffset;
    while (written < count) {
      const chunk = this.chunks[chunkIndex];
      if (chunk === undefined) {
        throw new RangeError(`only ${this.size} bytes queued, ${count} requested`);
      }
      const piece = chunk.subarray(offset, offset + (count - written));
      result.set(piece, written);
      written += piece.byteLength;
      offset += piece.byteLength;
      if (offset === chunk.byteLength) {
        chunkIndex += 1;
        offset = 0;
      }
    }
    if (consume) {
      this.chunks.splice(0, chunkIndex);
      this.headOffset = offset;
      this.size -= count;
    }
    return result;
  }
}
