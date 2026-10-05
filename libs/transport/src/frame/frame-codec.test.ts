import type { Frame } from './frame';
import { FRAME_TYPE, FrameProtocolError, MAX_DATA_FRAME_BYTES } from './frame';
import { encodeFrame, FrameDecoder } from './frame-codec';

/** Quadratic copying took ~280 ms per frame here, over a second for four; linear takes tens. */

const FRAMES: readonly Frame[] = [
  { kind: 'head', json: { method: 'POST', url: 'https://x/a', header: [['a', 'b']] } },
  { kind: 'data', bytes: new Uint8Array([1, 2, 3, 4, 5]) },
  { kind: 'data', bytes: new Uint8Array(0) },
  { kind: 'end', json: { trailer: [] } },
];

function joined(frames: readonly Frame[]): Uint8Array {
  const parts = frames.map(encodeFrame);
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return bytes;
}

describe('frame codec', () => {
  it('restores the frames however the byte stream happens to be chunked', () => {
    const bytes = joined(FRAMES);
    for (const chunkSize of [1, 2, 3, 7, bytes.byteLength]) {
      const decoder = new FrameDecoder();
      const decoded: Frame[] = [];
      for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
        decoded.push(...decoder.push(bytes.subarray(offset, offset + chunkSize)));
      }
      expect(decoded).toEqual(FRAMES);
      expect(decoder.hasPartialFrame).toBe(false);
    }
  });

  it('keeps an incomplete frame until the rest arrives', () => {
    const decoder = new FrameDecoder();
    const bytes = encodeFrame({ kind: 'data', bytes: new Uint8Array([9, 9, 9]) });
    expect(decoder.push(bytes.subarray(0, 6))).toEqual([]);
    expect(decoder.hasPartialFrame).toBe(true);
  });

  it('rejects a frame that declares more bytes than its type allows, before buffering them', () => {
    const header = new Uint8Array(5);
    new DataView(header.buffer).setUint8(0, FRAME_TYPE.data);
    new DataView(header.buffer).setUint32(1, MAX_DATA_FRAME_BYTES + 1);
    expect(() => new FrameDecoder().push(header)).toThrow(FrameProtocolError);
  });

  it('rejects unknown frame types and malformed JSON', () => {
    expect(() => new FrameDecoder().push(new Uint8Array([42, 0, 0, 0, 0]))).toThrow(
      FrameProtocolError
    );
    const badJson = new Uint8Array([FRAME_TYPE.head, 0, 0, 0, 1, 0x7b]);
    expect(() => new FrameDecoder().push(badJson)).toThrow(FrameProtocolError);
  });

  it('refuses to encode a DATA frame larger than the limit', () => {
    expect(() =>
      encodeFrame({ kind: 'data', bytes: new Uint8Array(MAX_DATA_FRAME_BYTES + 1) })
    ).toThrow(FrameProtocolError);
  });
});
