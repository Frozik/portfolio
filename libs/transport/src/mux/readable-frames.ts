import { encodeEnvelopes } from '@connectrpc/connect/protocol';
import { endStreamFlag } from '@connectrpc/connect/protocol-connect';
import { parseJson } from '@frozik/utils/parseJson';
import { z } from 'zod';

import type { Frame } from '../frame/frame';
import { FRAME_TYPE } from '../frame/frame';
import { encodeFrame } from '../frame/frame-codec';

/** Frames and Connect envelopes share the header shape: a type or flags byte, then a big-endian u32 length. */
const SIZED_HEADER_BYTES = 5;
const LENGTH_OFFSET = 1;
const PLAIN_ENVELOPE_FLAGS = 0;

const JsonSchema = z.json();
type JsonValue = z.infer<typeof JsonSchema>;

const ReadableEnvelopeSchema = z.strictObject({
  flags: z.number().int().min(0).max(0xff).optional(),
  message: JsonSchema,
});

/** A frame of the tunnel as JSON: HEAD and END as they are, a body as its JSON or its Connect envelopes. */
export const ReadableFrameSchema = z.union([
  z.strictObject({ head: JsonSchema }),
  z.strictObject({ end: JsonSchema }),
  z.strictObject({ body: JsonSchema }),
  z.strictObject({ messages: z.array(ReadableEnvelopeSchema).readonly() }),
]);

export type ReadableFrame = z.infer<typeof ReadableFrameSchema>;
type ReadableEnvelope = z.infer<typeof ReadableEnvelopeSchema>;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: true });

/**
 * The frames a DATA chunk carries, when every one of them reads as JSON and
 * turns back into exactly these bytes; otherwise undefined and the chunk
 * travels as bytes. A chunk cut mid-frame by the credit window, a compressed
 * or a protobuf message all stay binary.
 */
export function readableFrames(bytes: Uint8Array): readonly ReadableFrame[] | undefined {
  const frames = parseFrames(bytes);
  if (frames === undefined || !equalBytes(framesToBytes(frames), bytes)) {
    return undefined;
  }
  return frames;
}

export function framesToBytes(frames: readonly ReadableFrame[]): Uint8Array {
  return concatBytes(frames.map(frame => encodeFrame(toFrame(frame))));
}

function toFrame(frame: ReadableFrame): Frame {
  if ('head' in frame) {
    return { kind: 'head', json: frame.head };
  }
  if ('end' in frame) {
    return { kind: 'end', json: frame.end };
  }
  if ('body' in frame) {
    return { kind: 'data', bytes: jsonBytes(frame.body) };
  }
  return {
    kind: 'data',
    bytes: encodeEnvelopes(
      ...frame.messages.map(envelope => ({
        flags: envelope.flags ?? PLAIN_ENVELOPE_FLAGS,
        data: jsonBytes(envelope.message),
      }))
    ),
  };
}

function parseFrames(bytes: Uint8Array): ReadableFrame[] | undefined {
  const frames: ReadableFrame[] = [];
  let offset = 0;
  while (offset < bytes.byteLength) {
    const payload = sizedPayload(bytes, offset);
    if (payload === undefined) {
      return undefined;
    }
    const frame = readableFrame(bytes[offset], payload);
    if (frame === undefined) {
      return undefined;
    }
    frames.push(frame);
    offset += SIZED_HEADER_BYTES + payload.byteLength;
  }
  return frames;
}

function readableFrame(type: number | undefined, payload: Uint8Array): ReadableFrame | undefined {
  switch (type) {
    case FRAME_TYPE.head: {
      const head = parseJsonBytes(payload);
      return head === undefined ? undefined : { head };
    }
    case FRAME_TYPE.end: {
      const end = parseJsonBytes(payload);
      return end === undefined ? undefined : { end };
    }
    case FRAME_TYPE.data:
      return readableBody(payload);
    default:
      return undefined;
  }
}

/** JSON text never starts with a control byte, so a leading envelope flag tells the two body shapes apart. */
function readableBody(payload: Uint8Array): ReadableFrame | undefined {
  const first = payload[0];
  if (first === PLAIN_ENVELOPE_FLAGS || first === endStreamFlag) {
    const messages = readableEnvelopes(payload);
    return messages === undefined ? undefined : { messages };
  }
  const body = parseJsonBytes(payload);
  return body === undefined ? undefined : { body };
}

function readableEnvelopes(payload: Uint8Array): ReadableEnvelope[] | undefined {
  const envelopes: ReadableEnvelope[] = [];
  let offset = 0;
  while (offset < payload.byteLength) {
    const data = sizedPayload(payload, offset);
    if (data === undefined) {
      return undefined;
    }
    const flags = payload[offset];
    const message = parseJsonBytes(data);
    if (message === undefined) {
      return undefined;
    }
    envelopes.push(flags === PLAIN_ENVELOPE_FLAGS ? { message } : { flags, message });
    offset += SIZED_HEADER_BYTES + data.byteLength;
  }
  return envelopes;
}

function sizedPayload(bytes: Uint8Array, offset: number): Uint8Array | undefined {
  const start = offset + SIZED_HEADER_BYTES;
  if (start > bytes.byteLength) {
    return undefined;
  }
  const length = new DataView(bytes.buffer, bytes.byteOffset).getUint32(offset + LENGTH_OFFSET);
  const end = start + length;
  return end > bytes.byteLength ? undefined : bytes.subarray(start, end);
}

function parseJsonBytes(bytes: Uint8Array): JsonValue | undefined {
  const text = decodeUtf8(bytes);
  return text === undefined ? undefined : parseJson<JsonValue>(text);
}

/** Bytes that are not UTF-8 are simply not text; the chunk then travels as bytes. */
function decodeUtf8(bytes: Uint8Array): string | undefined {
  try {
    return textDecoder.decode(bytes);
  } catch {
    return undefined;
  }
}

function jsonBytes(json: unknown): Uint8Array {
  return textEncoder.encode(JSON.stringify(json));
}

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const all = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    all.set(part, offset);
    offset += part.byteLength;
  }
  return all;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}
