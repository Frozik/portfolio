import type { IDenseLayer } from './DenseNetwork';
import type { DenseNetwork } from './DenseNetwork';
import type { IAxonDescriptor, INeuronDescriptor, TLayerDescriptor } from './types';
import { ELayerType, ENeuronLayerType } from './types';

function neuronId(layerIndex: number, neuronIndex: number): string {
  return `neuron-${layerIndex}-${neuronIndex}`;
}

function inputNeurons(count: number): INeuronDescriptor[] {
  return Array.from({ length: count }, (_, index) => ({ id: neuronId(0, index), bias: 0 }));
}

function unitNeurons(layerIndex: number, biases: Float32Array): INeuronDescriptor[] {
  return Array.from(biases, (bias, index) => ({ id: neuronId(layerIndex, index), bias }));
}

function axonsOf(
  layerIndex: number,
  { inputSize, outputSize, weights }: IDenseLayer
): IAxonDescriptor[] {
  return Array.from({ length: inputSize * outputSize }, (_, index) => {
    const feature = Math.trunc(index / outputSize);
    const unit = index % outputSize;

    return {
      id: `axon-${layerIndex}-${feature}-${unit}`,
      from: neuronId(layerIndex - 1, feature),
      to: neuronId(layerIndex, unit),
      weight: weights[index],
    };
  });
}

/**
 * Reads a network into alternating neuron and axon layers. Neuron ids are
 * positional, so the same network always describes identically and a selection
 * survives a re-description.
 */
export function describeNetwork(network: DenseNetwork): readonly TLayerDescriptor[] {
  const described: TLayerDescriptor[] = [
    {
      type: ELayerType.Neuron,
      neuronLayerType: ENeuronLayerType.Input,
      neurons: inputNeurons(network.inputSize),
    },
  ];

  network.layers.forEach((layer, index, { length }) => {
    const layerIndex = index + 1;

    described.push(
      { type: ELayerType.Axon, axons: axonsOf(layerIndex, layer) },
      {
        type: ELayerType.Neuron,
        neuronLayerType: index === length - 1 ? ENeuronLayerType.Output : ENeuronLayerType.Hidden,
        neurons: unitNeurons(layerIndex, layer.biases),
      }
    );
  });

  return described;
}
