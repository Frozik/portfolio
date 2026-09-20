import { createDenseNetwork } from './createDenseNetwork';

describe('createDenseNetwork', () => {
  it('builds one layer per requested width, chained input to output', () => {
    const network = createDenseNetwork([5, 16, 1]);

    expect(network.layers.map(({ inputSize, outputSize }) => [inputSize, outputSize])).toEqual([
      [5, 16],
      [16, 1],
    ]);
    expect(network.layers.map(({ weights }) => weights.length)).toEqual([80, 16]);
  });

  it('starts every unit unbiased', () => {
    const network = createDenseNetwork([4, 3, 2]);

    expect(network.layers.every(({ biases }) => biases.every(bias => bias === 0))).toBe(true);
  });

  it('draws weights within the glorot range of the layer it belongs to', () => {
    const [inputSize, outputSize] = [5, 16];
    const truncatedLimit = 2 * Math.sqrt(1 / ((inputSize + outputSize) / 2));

    const { weights } = createDenseNetwork([inputSize, outputSize]).layers[0];

    expect(weights.every(weight => Math.abs(weight) <= truncatedLimit)).toBe(true);
    expect(weights.some(weight => weight !== 0)).toBe(true);
  });

  it('refuses a shape that has no layer in it', () => {
    expect(() => createDenseNetwork([5])).toThrow();
  });
});
