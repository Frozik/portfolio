import { createDenseNetwork } from '../neural-network/createDenseNetwork';
import { OBSERVATION_SIZE } from './observation';
import { acceptsObservation, createPolicyNetwork } from './policy-network';

describe('createPolicyNetwork', () => {
  it('reads the observation and answers with one bounded command', () => {
    const network = createPolicyNetwork();
    const command = network.predict(new Array(OBSERVATION_SIZE).fill(1))[0];

    expect(network.inputSize).toBe(OBSERVATION_SIZE);
    expect(network.outputSize).toBe(1);
    expect(Math.abs(command)).toBeLessThanOrEqual(1);
  });
});

describe('acceptsObservation', () => {
  it('accepts a network built for the current observation', () => {
    expect(acceptsObservation(createPolicyNetwork())).toBe(true);
  });

  it('rejects a network trained on the older four inputs', () => {
    expect(acceptsObservation(createDenseNetwork([OBSERVATION_SIZE - 1, 1]))).toBe(false);
  });
});
