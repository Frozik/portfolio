import { assertNever } from '@frozik/utils/assert/assertNever';
import { parseJson } from '@frozik/utils/parseJson';
import { z } from 'zod';

import { MUX_MAX_TEXT_MESSAGE_BYTES } from './mux-limits';
import type { MuxMessage } from './mux-message';
import { MUX_TYPE, MuxProtocolError } from './mux-message';
import type { ReadableFrame } from './readable-frames';
import { framesToBytes, ReadableFrameSchema, readableFrames } from './readable-frames';

const MAX_U32 = 0xff_ff_ff_ff;
const RAW_DATA_HEADER_BYTES = 4;

const StreamIdSchema = z.number().int().min(0).max(MAX_U32);

const TextMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('open'), stream: StreamIdSchema }),
  z.strictObject({ type: z.literal('fin'), stream: StreamIdSchema }),
  z.strictObject({ type: z.literal('reset'), stream: StreamIdSchema }),
  z.strictObject({
    type: z.literal('credit'),
    stream: StreamIdSchema,
    bytes: z.number().int().min(0).max(MAX_U32),
  }),
  z.strictObject({
    type: z.literal('data'),
    stream: StreamIdSchema,
    frames: z.array(ReadableFrameSchema).readonly(),
  }),
]);

const textEncoder = new TextEncoder();

/**
 * `frozik-mux-json.v1`: every message is JSON text, except DATA that does not
 * read as JSON — raw bytes, a protobuf message — which goes as a binary
 * message `[u32 stream id][bytes]`.
 */
export function encodeJsonMuxMessage(message: MuxMessage): Uint8Array<ArrayBuffer> | string {
  const stream = message.streamId;
  switch (message.type) {
    case MUX_TYPE.open:
      return JSON.stringify({ type: 'open', stream });
    case MUX_TYPE.fin:
      return JSON.stringify({ type: 'fin', stream });
    case MUX_TYPE.reset:
      return JSON.stringify({ type: 'reset', stream });
    case MUX_TYPE.credit:
      return JSON.stringify({ type: 'credit', stream, bytes: message.bytes });
    case MUX_TYPE.data:
      return encodeData(stream, message.bytes);
    default:
      return assertNever(message);
  }
}

function encodeData(stream: number, bytes: Uint8Array): Uint8Array<ArrayBuffer> | string {
  const frames = readableFrames(bytes);
  if (frames !== undefined) {
    const text = JSON.stringify({ type: 'data', stream, frames });
    if (textEncoder.encode(text).byteLength <= MUX_MAX_TEXT_MESSAGE_BYTES) {
      return text;
    }
  }
  const encoded = new Uint8Array(RAW_DATA_HEADER_BYTES + bytes.byteLength);
  new DataView(encoded.buffer).setUint32(0, stream);
  encoded.set(bytes, RAW_DATA_HEADER_BYTES);
  return encoded;
}

export function decodeJsonMuxMessage(
  encoded: Uint8Array | string,
  maxDataBytes: number
): MuxMessage {
  return typeof encoded === 'string'
    ? decodeText(encoded, maxDataBytes)
    : decodeRawData(encoded, maxDataBytes);
}

function decodeText(text: string, maxDataBytes: number): MuxMessage {
  const parsed = TextMessageSchema.safeParse(parseJson(text));
  if (!parsed.success) {
    throw new MuxProtocolError('malformed JSON message');
  }
  const message = parsed.data;
  const streamId = message.stream;
  switch (message.type) {
    case 'open':
      return { type: MUX_TYPE.open, streamId };
    case 'fin':
      return { type: MUX_TYPE.fin, streamId };
    case 'reset':
      return { type: MUX_TYPE.reset, streamId };
    case 'credit':
      return { type: MUX_TYPE.credit, streamId, bytes: message.bytes };
    case 'data':
      return { type: MUX_TYPE.data, streamId, bytes: dataBytes(message.frames, maxDataBytes) };
    default:
      return assertNever(message);
  }
}

function dataBytes(frames: readonly ReadableFrame[], maxDataBytes: number): Uint8Array {
  let bytes: Uint8Array;
  try {
    bytes = framesToBytes(frames);
  } catch (error) {
    throw new MuxProtocolError('DATA frames do not encode', { cause: error });
  }
  if (bytes.byteLength > maxDataBytes) {
    throw new MuxProtocolError(`DATA of ${bytes.byteLength} bytes exceeds ${maxDataBytes}`);
  }
  return bytes;
}

function decodeRawData(encoded: Uint8Array, maxDataBytes: number): MuxMessage {
  if (encoded.byteLength < RAW_DATA_HEADER_BYTES) {
    throw new MuxProtocolError('binary DATA shorter than its stream id');
  }
  const payloadBytes = encoded.byteLength - RAW_DATA_HEADER_BYTES;
  if (payloadBytes > maxDataBytes) {
    throw new MuxProtocolError(`DATA of ${payloadBytes} bytes exceeds ${maxDataBytes}`);
  }
  return {
    type: MUX_TYPE.data,
    streamId: new DataView(encoded.buffer, encoded.byteOffset).getUint32(0),
    bytes: encoded.subarray(RAW_DATA_HEADER_BYTES),
  };
}
