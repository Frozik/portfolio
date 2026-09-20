import { DenseNetwork } from '../neural-network/DenseNetwork';
import {
  crossoverNetworks,
  IncompatibleNetworkTopologyError,
  mutateNetwork,
} from './network-operators';

function uniformNetwork(value: number, shapes: readonly (readonly [number, number])[]) {
  return new DenseNetwork(
    shapes.map(([inputSize, outputSize]) => ({
      inputSize,
      outputSize,
      weights: Float32Array.from(new Array(inputSize * outputSize).fill(value)),
      biases: Float32Array.from(new Array(outputSize).fill(value)),
    }))
  );
}

const SHAPES = [
  [4, 3],
  [3, 1],
] as const;

describe('mutateNetwork', () => {
  it('keeps the shape of the parent it descends from', () => {
    const child = mutateNetwork(uniformNetwork(0, SHAPES), 0.1);

    expect(child.layers.map(({ inputSize, outputSize }) => [inputSize, outputSize])).toEqual([
      [4, 3],
      [3, 1],
    ]);
  });

  it('leaves the parent untouched', () => {
    const parent = uniformNetwork(1, SHAPES);

    mutateNetwork(parent, 5);

    expect(parent.layers.every(({ weights }) => weights.every(weight => weight === 1))).toBe(true);
  });

  it('nudges every weight and bias when asked for noise', () => {
    const child = mutateNetwork(uniformNetwork(1, SHAPES), 0.5);

    expect(child.layers.every(({ weights }) => weights.every(weight => weight !== 1))).toBe(true);
    expect(child.layers.every(({ biases }) => biases.every(bias => bias !== 1))).toBe(true);
  });

  it('reproduces the parent exactly at a zero rate', () => {
    const child = mutateNetwork(uniformNetwork(0.25, SHAPES), 0);

    expect(child.layers.every(({ weights }) => weights.every(weight => weight === 0.25))).toBe(
      true
    );
  });
});

describe('crossoverNetworks', () => {
  it('inherits every weight from one parent or the other', () => {
    const child = crossoverNetworks(uniformNetwork(1, SHAPES), uniformNetwork(2, SHAPES));

    expect(
      child.layers.every(({ weights }) => weights.every(weight => weight === 1 || weight === 2))
    ).toBe(true);
  });

  it('draws on both parents across repeated breedings', () => {
    const father = uniformNetwork(1, SHAPES);
    const mother = uniformNetwork(2, SHAPES);

    const inherited = new Set(
      Array.from({ length: 50 }, () =>
        Array.from(crossoverNetworks(father, mother).layers[0].weights)
      ).flat()
    );

    expect(inherited).toEqual(new Set([1, 2]));
  });

  it('refuses parents of a different depth', () => {
    expect(() => crossoverNetworks(uniformNetwork(1, SHAPES), uniformNetwork(1, [[4, 3]]))).toThrow(
      IncompatibleNetworkTopologyError
    );
  });

  it('refuses parents whose layers are shaped differently', () => {
    expect(() =>
      crossoverNetworks(
        uniformNetwork(1, [
          [4, 3],
          [3, 1],
        ]),
        uniformNetwork(1, [
          [4, 2],
          [2, 1],
        ])
      )
    ).toThrow(IncompatibleNetworkTopologyError);
  });
});
