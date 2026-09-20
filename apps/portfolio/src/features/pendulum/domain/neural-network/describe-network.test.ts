import { DenseNetwork } from './DenseNetwork';
import { describeNetwork } from './describe-network';
import { ELayerType, ENeuronLayerType } from './types';

const network = new DenseNetwork([
  {
    inputSize: 2,
    outputSize: 2,
    weights: Float32Array.from([1, 2, 3, 4]),
    biases: Float32Array.from([0.5, 0.25]),
  },
  {
    inputSize: 2,
    outputSize: 1,
    weights: Float32Array.from([5, 6]),
    biases: Float32Array.from([0.75]),
  },
]);

describe('describeNetwork', () => {
  it('alternates neurons and axons from the input layer to the output layer', () => {
    expect(describeNetwork(network).map(({ type }) => type)).toEqual([
      ELayerType.Neuron,
      ELayerType.Axon,
      ELayerType.Neuron,
      ELayerType.Axon,
      ELayerType.Neuron,
    ]);
  });

  it('names the first neuron layer the input and the last one the output', () => {
    const neuronLayers = describeNetwork(network).flatMap(layer =>
      layer.type === ELayerType.Neuron ? [layer] : []
    );

    expect(neuronLayers.map(({ neuronLayerType }) => neuronLayerType)).toEqual([
      ENeuronLayerType.Input,
      ENeuronLayerType.Hidden,
      ENeuronLayerType.Output,
    ]);
  });

  it('leaves the inputs unbiased and carries the bias of every unit', () => {
    const biases = describeNetwork(network)
      .flatMap(layer => (layer.type === ELayerType.Neuron ? [layer] : []))
      .map(({ neurons }) => neurons.map(({ bias }) => bias));

    expect(biases).toEqual([[0, 0], [0.5, 0.25], [0.75]]);
  });

  it('draws one axon per weight, from its input neuron to its unit', () => {
    const [axonLayer] = describeNetwork(network).flatMap(layer =>
      layer.type === ELayerType.Axon ? [layer] : []
    );

    expect(axonLayer.axons.map(({ from, to, weight }) => [from, to, weight])).toEqual([
      ['neuron-0-0', 'neuron-1-0', 1],
      ['neuron-0-0', 'neuron-1-1', 2],
      ['neuron-0-1', 'neuron-1-0', 3],
      ['neuron-0-1', 'neuron-1-1', 4],
    ]);
  });

  it('describes the same network identically, so a selection survives', () => {
    expect(describeNetwork(network)).toEqual(describeNetwork(network));
  });
});
