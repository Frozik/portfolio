import type { ITableState } from '../../core/state/table-state';

interface IEnvelope {
  readonly version: number;
  readonly state: ITableState;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(text: string): string {
  return btoa(String.fromCodePoint(...encoder.encode(text)));
}

function fromBase64(encoded: string): string {
  return decoder.decode(Uint8Array.from(atob(encoded), character => character.codePointAt(0) ?? 0));
}

/** A table state as one URL-safe token, versioned so a stale link is ignored rather than misread. */
export function encodeState(state: ITableState, version: number): string {
  return toBase64(JSON.stringify({ version, state } satisfies IEnvelope));
}

export function decodeState(encoded: string, version: number): ITableState | undefined {
  try {
    const envelope = JSON.parse(fromBase64(encoded)) as Partial<IEnvelope>;
    return envelope.version === version && envelope.state !== undefined
      ? envelope.state
      : undefined;
  } catch {
    return undefined;
  }
}
