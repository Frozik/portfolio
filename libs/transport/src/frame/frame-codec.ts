import { assertNever } from '@frozik/utils/assert/assertNever';

import { ByteQueue } from './byte-queue';
import type { Frame } from './frame';
import {
  FRAME_HEADER_BYTES,
  FRAME_TYPE,
  FrameProtocolError,
  MAX_DATA_FRAME_BYTES,
  MAX_JSON_FRAME_BYTES,
} from './frame';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: true });

export function encodeFrame(frame: Frame): Uint8Array {
  switch (frame.kind) {
    case 'head':
      return withHeader(FRAME_TYPE.head, encodeJson(frame.json));
    case 'end':
      return withHeader(FRAME_TYPE.end, encodeJson(frame.json));
    case 'data':
      if (frame.bytes.byteLength > MAX_DATA_FRAME_BYTES) {
        throw new FrameProtocolError(`DATA frame of ${frame.bytes.byteLength} bytes is too large`);
      }
      return withHeader(FRAME_TYPE.data, frame.bytes);
    default:
      return assertNever(frame);
  }
}

function encodeJson(json: unknown): Uint8Array {
  const payload = textEncoder.encode(JSON.stringify(json));
  if (payload.byteLength > MAX_JSON_FRAME_BYTES) {
    throw new FrameProtocolError(`JSON frame of ${payload.byteLength} bytes is too large`);
  }
  return payload;
}

function withHeader(type: number, payload: Uint8Array): Uint8Array {
  const frame = new Uint8Array(FRAME_HEADER_BYTES + payload.byteLength);
  const view = new DataView(frame.buffer);
  view.setUint8(0, type);
  view.setUint32(1, payload.byteLength);
  frame.set(payload, FRAME_HEADER_BYTES);
  return frame;
}

/** Turns an arbitrary chunking of the byte stream back into frames; rejects anything malformed. */
export class FrameDecoder {
  private readonly queue = new ByteQueue();

  push(bytes: Uint8Array): readonly Frame[] {
    this.queue.push(bytes);
    const frames: Frame[] = [];
    for (;;) {
      const frame = this.takeFrame();
      if (frame === undefined) {
        return frames;
      }
      frames.push(frame);
    }
  }

  get hasPartialFrame(): boolean {
    return this.queue.length > 0;
  }

  private takeFrame(): Frame | undefined {
    if (this.queue.length < FRAME_HEADER_BYTES) {
      return undefined;
    }
    const header = new DataView(this.queue.peek(FRAME_HEADER_BYTES).buffer);
    const type = header.getUint8(0);
    const length = header.getUint32(1);
    if (length > maxPayloadBytes(type)) {
      throw new FrameProtocolError(`frame of type ${type} declares ${length} bytes`);
    }
    if (this.queue.length < FRAME_HEADER_BYTES + length) {
      return undefined;
    }
    this.queue.take(FRAME_HEADER_BYTES);
    return decodePayload(type, this.queue.take(length));
  }
}

function maxPayloadBytes(type: number): number {
  switch (type) {
    case FRAME_TYPE.head:
    case FRAME_TYPE.end:
      return MAX_JSON_FRAME_BYTES;
    case FRAME_TYPE.data:
      return MAX_DATA_FRAME_BYTES;
    default:
      throw new FrameProtocolError(`unknown frame type ${type}`);
  }
}

function decodePayload(type: number, payload: Uint8Array): Frame {
  if (type === FRAME_TYPE.data) {
    return { kind: 'data', bytes: payload };
  }
  const json = parseJson(payload);
  return type === FRAME_TYPE.head ? { kind: 'head', json } : { kind: 'end', json };
}

function parseJson(payload: Uint8Array): unknown {
  try {
    return JSON.parse(textDecoder.decode(payload));
  } catch (error) {
    throw new FrameProtocolError('frame carries malformed JSON', { cause: error });
  }
}
