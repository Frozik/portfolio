import { encodeEnvelope } from '@connectrpc/connect/protocol';
import { endStreamFlag } from '@connectrpc/connect/protocol-connect';

import { encodeFrame } from '../frame/frame-codec';
import { MUX_MAX_TEXT_MESSAGE_BYTES, MUX_PROTOCOL_LIMITS } from './mux-limits';
import type { MuxMessage } from './mux-message';
import { MUX_TYPE } from './mux-message';
import { MUX_WIRES } from './mux-wire';

const MAX_DATA_BYTES = MUX_PROTOCOL_LIMITS.maxDataBytes;
const wire = MUX_WIRES.json;
const textEncoder = new TextEncoder();

function dataOf(bytes: Uint8Array, streamId = 3): MuxMessage {
  return { type: MUX_TYPE.data, streamId, bytes };
}

function jsonEnvelope(json: unknown, flags = 0): Uint8Array {
  return encodeEnvelope(flags, textEncoder.encode(JSON.stringify(json)));
}

function roundTrip(message: MuxMessage): MuxMessage {
  return wire.decode(wire.encode(message), MAX_DATA_BYTES);
}

describe('mux JSON wire', () => {
  it('sends control messages as readable text', () => {
    expect(wire.encode({ type: MUX_TYPE.open, streamId: 1 })).toBe('{"type":"open","stream":1}');
    expect(wire.encode({ type: MUX_TYPE.credit, streamId: 5, bytes: 131_072 })).toBe(
      '{"type":"credit","stream":5,"bytes":131072}'
    );
  });

  it('shows a call head and its JSON body as frames, and turns them back into the same bytes', () => {
    const head = { method: 'POST', url: '/frozik.transport.v1.PlotService/GetPlotLimits' };
    const bytes = new Uint8Array([
      ...encodeFrame({ kind: 'head', json: head }),
      ...encodeFrame({ kind: 'data', bytes: textEncoder.encode('{"points":3}') }),
    ]);

    const encoded = wire.encode(dataOf(bytes));

    expect(JSON.parse(String(encoded))).toEqual({
      type: 'data',
      stream: 3,
      frames: [{ head }, { body: { points: 3 } }],
    });
    expect(roundTrip(dataOf(bytes))).toEqual(dataOf(bytes));
  });

  it('shows Connect stream messages one by one, the end of stream with its flag', () => {
    const bytes = encodeFrame({
      kind: 'data',
      bytes: new Uint8Array([
        ...jsonEnvelope({ x: [0, 1], y: ['NaN', 1] }),
        ...jsonEnvelope({ metadata: {} }, endStreamFlag),
      ]),
    });

    expect(JSON.parse(String(wire.encode(dataOf(bytes))))).toEqual({
      type: 'data',
      stream: 3,
      frames: [
        {
          messages: [
            { message: { x: [0, 1], y: ['NaN', 1] } },
            { flags: endStreamFlag, message: { metadata: {} } },
          ],
        },
      ],
    });
    expect(roundTrip(dataOf(bytes))).toEqual(dataOf(bytes));
  });

  it.each([
    [
      'a protobuf message',
      encodeFrame({ kind: 'data', bytes: encodeEnvelope(0, new Uint8Array([0x0a, 0x01, 0xff])) }),
    ],
    ['a chunk cut inside a frame', encodeFrame({ kind: 'end', json: { trailer: [] } }).slice(0, 7)],
    ['JSON whose spelling would not survive a round trip', encodeJsonFrame('{ "points": 3 }')],
  ])('keeps %s binary, prefixed by its stream id', (_, bytes) => {
    const encoded = wire.encode(dataOf(bytes, 0x01_02_03_04));

    expect(encoded).toBeInstanceOf(Uint8Array);
    expect(Array.from(encoded as Uint8Array).slice(0, 4)).toEqual([1, 2, 3, 4]);
    expect(roundTrip(dataOf(bytes, 0x01_02_03_04))).toEqual(dataOf(bytes, 0x01_02_03_04));
  });

  it('sends bytes when the readable form would outgrow a text message', () => {
    const envelope = jsonEnvelope(0);
    const count = Math.floor((MAX_DATA_BYTES - 64) / envelope.byteLength);
    const bytes = encodeFrame({
      kind: 'data',
      bytes: new Uint8Array(Array.from({ length: count }, () => [...envelope]).flat()),
    });
    const readable = JSON.stringify({
      messages: Array.from({ length: count }, () => ({ message: 0 })),
    });

    expect(readable.length).toBeGreaterThan(MUX_MAX_TEXT_MESSAGE_BYTES);
    expect(wire.encode(dataOf(bytes))).toBeInstanceOf(Uint8Array);
  });

  it.each([
    ['text that is not JSON', 'open'],
    ['an unknown type', '{"type":"ping","stream":1}'],
    ['a negative stream id', '{"type":"fin","stream":-1}'],
    ['a frame of two kinds', '{"type":"data","stream":1,"frames":[{"head":{},"end":{}}]}'],
    ['binary DATA without a whole stream id', new Uint8Array([0, 0, 1])],
    ['binary DATA over the limit', new Uint8Array(4 + MAX_DATA_BYTES + 1)],
  ])('rejects %s', (_, message) => {
    expect(() => wire.decode(message, MAX_DATA_BYTES)).toThrow();
  });

  it('rejects readable frames that add up to more DATA than allowed', () => {
    const body = 'x'.repeat(MAX_DATA_BYTES);
    const text = JSON.stringify({ type: 'data', stream: 1, frames: [{ body }] });

    expect(() => wire.decode(text, MAX_DATA_BYTES)).toThrow();
  });

  it('leaves the binary wire refusing text', () => {
    expect(() => MUX_WIRES.binary.decode('{"type":"open","stream":1}', MAX_DATA_BYTES)).toThrow();
  });
});

function encodeJsonFrame(text: string): Uint8Array {
  return encodeFrame({ kind: 'data', bytes: textEncoder.encode(text) });
}
