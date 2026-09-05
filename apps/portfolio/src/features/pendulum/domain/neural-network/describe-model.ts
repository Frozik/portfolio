import type { LayersModel } from '@tensorflow/tfjs';
import { tidy } from '@tensorflow/tfjs';
import { isNil, last } from 'lodash-es';

import type { IAxonDescriptor, INeuronDescriptor, TLayerDescriptor } from './types';
import { ELayerType, ENeuronLayerType } from './types';

const KERNEL_RANK = 2;

function neuronId(layerIndex: number, neuronIndex: number): string {
  return `neuron-${layerIndex}-${neuronIndex}`;
}

function neuronsOf(layerIndex: number, count: number): INeuronDescriptor[] {
  return Array.from({ length: count }, (_, neuronIndex) => ({
    id: neuronId(layerIndex, neuronIndex),
    bias: 0,
  }));
}

function axonsOf(layerIndex: number, weights: readonly (readonly number[])[]): IAxonDescriptor[] {
  return weights.flatMap((row, fromIndex) =>
    row.map((weight, toIndex) => ({
      id: `axon-${layerIndex}-${fromIndex}-${toIndex}`,
      from: neuronId(layerIndex - 1, fromIndex),
      to: neuronId(layerIndex, toIndex),
      weight,
    }))
  );
}

function withBiases(
  layer: TLayerDescriptor | undefined,
  biases: readonly number[]
): TLayerDescriptor {
  if (isNil(layer) || layer.type !== ELayerType.Neuron) {
    throw new Error('Bias weights must follow a neuron layer');
  }

  return {
    ...layer,
    neurons: layer.neurons.map((neuron, index) => ({ ...neuron, bias: biases[index] ?? 0 })),
  };
}

/**
 * Reads a dense feed-forward model into alternating neuron and axon layers.
 * Neuron ids are positional, so the same model always describes identically
 * and a selection survives a re-description.
 */
export function describeModel(model: LayersModel): readonly TLayerDescriptor[] {
  let described: TLayerDescriptor[] = [];

  tidy(() => {
    model.layers.forEach((layer, layerIndex, { length }) => {
      const denseLayerIndex = layerIndex + 1;

      for (const weight of layer.getWeights()) {
        if (weight.shape.length === KERNEL_RANK) {
          const kernel = weight.arraySync() as number[][];
          const [inputSize, outputSize] = weight.shape;

          if (described.length === 0) {
            described.push({
              type: ELayerType.Neuron,
              neuronLayerType: ENeuronLayerType.Input,
              neurons: neuronsOf(0, inputSize),
            });
          }

          described.push(
            { type: ELayerType.Axon, axons: axonsOf(denseLayerIndex, kernel) },
            {
              type: ELayerType.Neuron,
              neuronLayerType:
                layerIndex === length - 1 ? ENeuronLayerType.Output : ENeuronLayerType.Hidden,
              neurons: neuronsOf(denseLayerIndex, outputSize),
            }
          );
        } else {
          described = [
            ...described.slice(0, -1),
            withBiases(last(described), weight.arraySync() as number[]),
          ];
        }
      }
    });
  });

  return described;
}
