export const MUX_TYPE = {
  open: 1,
  data: 2,
  fin: 3,
  reset: 4,
  credit: 5,
} as const;

export type MuxMessage =
  | { readonly type: typeof MUX_TYPE.open; readonly streamId: number }
  | { readonly type: typeof MUX_TYPE.data; readonly streamId: number; readonly bytes: Uint8Array }
  | { readonly type: typeof MUX_TYPE.fin; readonly streamId: number }
  | { readonly type: typeof MUX_TYPE.reset; readonly streamId: number }
  | { readonly type: typeof MUX_TYPE.credit; readonly streamId: number; readonly bytes: number };

export const MUX_HEADER_BYTES = 5;
const CREDIT_PAYLOAD_BYTES = 4;

export class MuxProtocolError extends Error {
  override readonly name = 'MuxProtocolError';
}

export function encodeMuxMessage(message: MuxMessage): Uint8Array<ArrayBuffer> {
  const payloadBytes = payloadLength(message);
  const encoded = new Uint8Array(MUX_HEADER_BYTES + payloadBytes);
  const view = new DataView(encoded.buffer);
  view.setUint8(0, message.type);
  view.setUint32(1, message.streamId);
  if (message.type === MUX_TYPE.data) {
    encoded.set(message.bytes, MUX_HEADER_BYTES);
  } else if (message.type === MUX_TYPE.credit) {
    view.setUint32(MUX_HEADER_BYTES, message.bytes);
  }
  return encoded;
}

function payloadLength(message: MuxMessage): number {
  switch (message.type) {
    case MUX_TYPE.data:
      return message.bytes.byteLength;
    case MUX_TYPE.credit:
      return CREDIT_PAYLOAD_BYTES;
    default:
      return 0;
  }
}

export function decodeMuxMessage(encoded: Uint8Array, maxDataBytes: number): MuxMessage {
  if (encoded.byteLength < MUX_HEADER_BYTES) {
    throw new MuxProtocolError('message shorter than its header');
  }
  const view = new DataView(encoded.buffer, encoded.byteOffset, encoded.byteLength);
  const type = view.getUint8(0);
  const streamId = view.getUint32(1);
  const payloadBytes = encoded.byteLength - MUX_HEADER_BYTES;
  switch (type) {
    case MUX_TYPE.data:
      if (payloadBytes > maxDataBytes) {
        throw new MuxProtocolError(`DATA of ${payloadBytes} bytes exceeds ${maxDataBytes}`);
      }
      return { type, streamId, bytes: encoded.subarray(MUX_HEADER_BYTES) };
    case MUX_TYPE.credit:
      if (payloadBytes !== CREDIT_PAYLOAD_BYTES) {
        throw new MuxProtocolError('malformed CREDIT');
      }
      return { type, streamId, bytes: view.getUint32(MUX_HEADER_BYTES) };
    case MUX_TYPE.open:
    case MUX_TYPE.fin:
    case MUX_TYPE.reset:
      if (payloadBytes !== 0) {
        throw new MuxProtocolError(`message type ${type} carries no payload`);
      }
      return { type, streamId };
    default:
      throw new MuxProtocolError(`unknown message type ${type}`);
  }
}
