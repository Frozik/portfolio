import { DenseNetwork } from './DenseNetwork';

function layer(
  inputSize: number,
  outputSize: number,
  weights: readonly number[],
  biases: readonly number[]
) {
  return {
    inputSize,
    outputSize,
    weights: Float32Array.from(weights),
    biases: Float32Array.from(biases),
  };
}

describe('DenseNetwork', () => {
  it('answers with the weighted sum of its inputs through tanh', () => {
    const network = new DenseNetwork([layer(2, 1, [0.5, -0.25], [0.1])]);

    expect(network.predict([1, 2])[0]).toBeCloseTo(Math.tanh(0.1 + 0.5 - 0.5), 6);
  });

  it('feeds each layer into the next', () => {
    const network = new DenseNetwork([layer(1, 2, [1, 2], [0, 0]), layer(2, 1, [1, 1], [0])]);

    expect(network.predict([0.5])[0]).toBeCloseTo(Math.tanh(Math.tanh(0.5) + Math.tanh(1)), 6);
  });

  it('reports the width it reads and the width it answers with', () => {
    const network = new DenseNetwork([layer(3, 4, new Array(12).fill(0), [0, 0, 0, 0])]);

    expect([network.inputSize, network.outputSize]).toEqual([3, 4]);
  });

  it('refuses an observation of the wrong width', () => {
    const network = new DenseNetwork([layer(2, 1, [1, 1], [0])]);

    expect(() => network.predict([1])).toThrow();
  });

  it('keeps its own copy of the weights it was built from', () => {
    const weights = Float32Array.from([0.5, -0.25]);
    const network = new DenseNetwork([
      { inputSize: 2, outputSize: 1, weights, biases: Float32Array.from([0]) },
    ]);
    const answer = network.predict([1, 1])[0];

    weights[0] = 99;

    expect(network.predict([1, 1])[0]).toBe(answer);
  });

  it('snapshots into a value storage can clone', () => {
    const network = new DenseNetwork([layer(2, 1, [0.5, -0.25], [0.25])]);
    const observation = [0.3, -0.7];

    const stored = DenseNetwork.fromSnapshot(structuredClone(network.toSnapshot()));

    expect(stored.predict(observation)[0]).toBe(network.predict(observation)[0]);
  });

  it('refuses a layer whose weights do not fill its shape', () => {
    expect(() => new DenseNetwork([layer(2, 3, [1, 2, 3], [0, 0, 0])])).toThrow();
  });

  it('refuses a layer carrying the wrong number of biases', () => {
    expect(() => new DenseNetwork([layer(2, 1, [1, 1], [0, 0])])).toThrow();
  });

  it('refuses layers that do not join up', () => {
    expect(
      () =>
        new DenseNetwork([layer(2, 3, new Array(6).fill(0), [0, 0, 0]), layer(2, 1, [1, 1], [0])])
    ).toThrow();
  });

  it('answers identically after a round trip through a snapshot', () => {
    const network = new DenseNetwork([
      layer(2, 3, [0.1, -0.2, 0.3, 0.4, 0.5, -0.6], [0.01, 0.02, 0.03]),
      layer(3, 1, [0.7, -0.8, 0.9], [-0.1]),
    ]);
    const observation = [0.3, -0.7];
    const expected = network.predict(observation)[0];

    const restored = DenseNetwork.fromSnapshot(network.toSnapshot());

    expect(restored.predict(observation)[0]).toBe(expected);
  });
});
