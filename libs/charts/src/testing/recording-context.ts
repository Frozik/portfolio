export interface IRecordingContext {
  readonly context: CanvasRenderingContext2D;
  /** Every method called, with its arguments, and every property set, in order. */
  readonly calls: string[];
}

const GRADIENT = { addColorStop(): void {} };

/** A 2D context that draws nothing and writes down what it was asked to draw: how painters are tested without a canvas. */
export function recordingContext(): IRecordingContext {
  const calls: string[] = [];
  const recorder = new Proxy<Record<string, unknown>>(
    {},
    {
      get(target, name) {
        if (typeof name !== 'string') {
          return undefined;
        }
        if (name in target) {
          return target[name];
        }
        return (...parameters: readonly unknown[]): unknown => {
          calls.push(`${name}(${parameters.map(String).join(', ')})`);
          return name === 'createLinearGradient' ? GRADIENT : undefined;
        };
      },
      set(target, name, value) {
        if (typeof name === 'string') {
          target[name] = value;
          calls.push(`${name} = ${String(value)}`);
        }
        return true;
      },
    }
  );
  // The proxy answers to every member of the context; no type can say so.
  return { context: recorder as unknown as CanvasRenderingContext2D, calls };
}
