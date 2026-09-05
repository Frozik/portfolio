import type { LayersModel } from '@tensorflow/tfjs';
import { layers, sequential, setBackend } from '@tensorflow/tfjs';

const TF_BACKEND = 'cpu';

// Normalized bob velocity (x, y), bob angle and pivot position.
const INPUT_FEATURES = 4;
const HIDDEN_UNITS = 10;
// One output: the pivot velocity.
const OUTPUT_UNITS = 1;

let backendReady: Promise<void> | undefined;

/** Awaited once before the first model is built; a synchronous constructor must not race the backend switch. */
export function ensureTensorflowBackend(): Promise<void> {
  backendReady ??= setBackend(TF_BACKEND).then(() => undefined);
  return backendReady;
}

export function createInitialModel(): LayersModel {
  const model = sequential();

  model.add(
    layers.dense({ inputShape: [INPUT_FEATURES], units: HIDDEN_UNITS, activation: 'relu' })
  );
  model.add(layers.dense({ units: HIDDEN_UNITS, activation: 'linear' }));
  model.add(layers.dense({ units: OUTPUT_UNITS, activation: 'tanh' }));

  model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });

  return model;
}
