import { layers, sequential } from '@tensorflow/tfjs';

import { OBSERVATION_SIZE } from './observation';
import {
  acceptsObservation,
  createInitialModel,
  ensureTensorflowBackend,
} from './tensorflow-model';

beforeAll(() => ensureTensorflowBackend());

describe('createInitialModel', () => {
  it('reads the observation and answers with one bounded command', () => {
    const model = createInitialModel();

    expect(acceptsObservation(model)).toBe(true);
    expect(model.outputs[0]?.shape.at(-1)).toBe(1);
    model.dispose();
  });
});

describe('acceptsObservation', () => {
  it('rejects a network trained on the older four inputs', () => {
    const legacy = sequential();
    legacy.add(layers.dense({ inputShape: [OBSERVATION_SIZE - 1], units: 1 }));

    expect(acceptsObservation(legacy)).toBe(false);
    legacy.dispose();
  });
});
