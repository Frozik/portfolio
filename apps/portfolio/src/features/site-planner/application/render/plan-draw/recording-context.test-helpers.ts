import { vi } from 'vitest';

/**
 * A canvas 2D context that records instead of painting. happy-dom ships no
 * canvas rasterizer, so the drawing modules are specified by the operations
 * they emit: every method call and property assignment lands in `calls`, in
 * order, and the few queries whose answers the modules actually read
 * (`measureText`, `isPointInPath`, `createLinearGradient`) answer with stubs.
 */
export interface RecordedCall {
  readonly target: string;
  readonly method: string;
  readonly args: readonly unknown[];
}

const MEASURED_CHAR_WIDTH_PX = 6;

/** Marks a property assignment in the recording: `set:fillStyle`, `set:font`… */
export const SET_PREFIX = 'set:';

function createRecorder(target: string, calls: RecordedCall[]): object {
  const state: Record<string, unknown> = {};

  return new Proxy(state, {
    get(_ignored, property) {
      if (typeof property !== 'string') {
        return undefined;
      }

      if (property in state) {
        return state[property];
      }

      switch (property) {
        case 'measureText':
          return (text: string) => ({ width: text.length * MEASURED_CHAR_WIDTH_PX });
        case 'isPointInPath':
          return () => true;
        case 'createLinearGradient':
        case 'createRadialGradient':
          return (...args: readonly unknown[]) => {
            calls.push({ target, method: property, args });

            return { addColorStop: (): void => undefined };
          };
        default:
          return (...args: readonly unknown[]) => {
            calls.push({ target, method: property, args });

            return undefined;
          };
      }
    },
    set(_ignored, property, value) {
      if (typeof property === 'string') {
        state[property] = value;
        calls.push({ target, method: `${SET_PREFIX}${property}`, args: [value] });
      }

      return true;
    },
  });
}

export interface ContextRecording {
  readonly ctx: CanvasRenderingContext2D;
  readonly calls: RecordedCall[];
}

export function createRecordingContext(): ContextRecording {
  const calls: RecordedCall[] = [];

  return { ctx: createRecorder('ctx', calls) as CanvasRenderingContext2D, calls };
}

/**
 * Replaces the missing global `Path2D` with a recorder. Every path constructed
 * while the stub stands appends its operations to the SAME `calls` list the
 * context writes to, targeted `path#<n>`, so a test reads one interleaved
 * transcript. Returns that list for tests that draw through paths alone.
 */
export function stubRecordingPath2D(calls: RecordedCall[]): void {
  let counter = 0;

  vi.stubGlobal(
    'Path2D',
    class {
      constructor() {
        counter += 1;

        // A Proxy IS the constructed object — the class only names the global.
        // biome-ignore lint/correctness/noConstructorReturn: the recorder must impersonate Path2D wholesale
        return createRecorder(`path#${counter}`, calls);
      }
    }
  );
}

export function callsOf(
  calls: readonly RecordedCall[],
  method: string,
  target?: string
): readonly RecordedCall[] {
  return calls.filter(
    call => call.method === method && (target === undefined || call.target === target)
  );
}

/** Every value a property was assigned, in order: `valuesSet(calls, 'fillStyle')`. */
export function valuesSet(calls: readonly RecordedCall[], property: string): readonly unknown[] {
  return callsOf(calls, `${SET_PREFIX}${property}`).map(call => call.args[0]);
}
