import type { WireFormat } from '../shared/wire-format';
import { decodeJsonMuxMessage, encodeJsonMuxMessage } from './mux-json-message';
import type { MuxMessage } from './mux-message';
import { decodeMuxMessage, encodeMuxMessage, MuxProtocolError } from './mux-message';

/** How mux messages become WebSocket messages; the subprotocol names the wire and its version (README, «Multiplexer protocol»). */
export interface IMuxWire {
  readonly subprotocol: string;
  encode(message: MuxMessage): Uint8Array<ArrayBuffer> | string;
  decode(message: Uint8Array | string, maxDataBytes: number): MuxMessage;
}

export const MUX_WIRES: Readonly<Record<WireFormat, IMuxWire>> = {
  binary: {
    subprotocol: 'frozik-mux.v1',
    encode: encodeMuxMessage,
    decode: (message, maxDataBytes) => {
      if (typeof message === 'string') {
        throw new MuxProtocolError('binary messages only');
      }
      return decodeMuxMessage(message, maxDataBytes);
    },
  },
  json: {
    subprotocol: 'frozik-mux-json.v1',
    encode: encodeJsonMuxMessage,
    decode: decodeJsonMuxMessage,
  },
};

/** A client that names no subprotocol predates them and speaks binary. */
export function muxWireOf(subprotocol: string): IMuxWire {
  return subprotocol === MUX_WIRES.json.subprotocol ? MUX_WIRES.json : MUX_WIRES.binary;
}
