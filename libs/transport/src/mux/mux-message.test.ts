import type { MuxMessage } from './mux-message';
import { decodeMuxMessage, encodeMuxMessage, MUX_TYPE } from './mux-message';
import vectors from './mux-vectors.json';

interface VectorMessage {
  readonly type: string;
  readonly streamId: number;
  readonly hex?: string;
  readonly bytes?: number;
}

function bytesOf(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/../g) ?? [], pair => Number.parseInt(pair, 16));
}

function messageOf({ type, streamId, hex = '', bytes = 0 }: VectorMessage): MuxMessage {
  switch (type) {
    case 'open':
      return { type: MUX_TYPE.open, streamId };
    case 'data':
      return { type: MUX_TYPE.data, streamId, bytes: bytesOf(hex) };
    case 'fin':
      return { type: MUX_TYPE.fin, streamId };
    case 'reset':
      return { type: MUX_TYPE.reset, streamId };
    case 'credit':
      return { type: MUX_TYPE.credit, streamId, bytes };
    default:
      throw new Error(`unknown vector type ${type}`);
  }
}

/** The vectors are shared with the Go gateway (`apps/transport-gateway/internal/mux`). */
describe('mux v1 wire format', () => {
  it.each(vectors.valid)('encodes and decodes $name', ({ hex, message }) => {
    const expected = messageOf(message);

    expect(encodeMuxMessage(expected)).toEqual(bytesOf(hex));
    expect(decodeMuxMessage(bytesOf(hex), vectors.maxDataBytes)).toEqual(expected);
  });

  it.each(vectors.invalid)('rejects $name', ({ hex, payloadBytes = 0 }) => {
    const header = bytesOf(hex);
    const encoded = new Uint8Array(header.byteLength + payloadBytes);
    encoded.set(header);

    expect(() => decodeMuxMessage(encoded, vectors.maxDataBytes)).toThrow();
  });
});
