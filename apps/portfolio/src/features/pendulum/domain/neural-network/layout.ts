import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import type { IPoint } from '../types';
import {
  AXON_LENGTH,
  NEURON_DIAMETER,
  NEURON_MARGIN,
  NEURON_RADIUS,
  NEURON_SQUARE_RADIUS,
} from './constants';
import type {
  ENeuronLayerType,
  IAxonDescriptor,
  INeuronDescriptor,
  INeuronLayerDescriptor,
  TLayerDescriptor,
} from './types';
import { ELayerType } from './types';

export interface INeuronLayoutObject extends INeuronDescriptor {
  readonly type: ELayerType.Neuron;
  readonly layerType: ENeuronLayerType;
  readonly x: number;
  readonly y: number;
}

export interface IAxonLayoutObject extends IAxonDescriptor {
  readonly type: ELayerType.Axon;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly neuronFromX: number;
  readonly neuronFromY: number;
  readonly neuronToX: number;
  readonly neuronToY: number;
}

export type TNeuralNetworkLayoutObject = INeuronLayoutObject | IAxonLayoutObject;

export interface INeuralNetworkLayout {
  readonly objects: readonly TNeuralNetworkLayoutObject[];
  readonly width: number;
  readonly height: number;
}

export function buildNeuralNetworkLayout(
  layers: readonly TLayerDescriptor[]
): INeuralNetworkLayout {
  const neuronLayers = layers.filter(
    (layer): layer is INeuronLayerDescriptor => layer.type === ELayerType.Neuron
  );

  if (neuronLayers.length === 0) {
    return { objects: [], width: 0, height: 0 };
  }

  const maxNeuronsInLayer = Math.max(...neuronLayers.map(({ neurons: { length } }) => length));

  const height = maxNeuronsInLayer * NEURON_DIAMETER + (maxNeuronsInLayer - 1) * NEURON_MARGIN;
  const width = layers.reduce((accumulatedWidth, layer, index, { length }) => {
    const { type } = layer;

    if (index !== length - 1) {
      accumulatedWidth += NEURON_MARGIN;
    }

    switch (type) {
      case ELayerType.Neuron: {
        return accumulatedWidth + NEURON_DIAMETER;
      }

      case ELayerType.Axon: {
        return accumulatedWidth + AXON_LENGTH;
      }

      default:
        assertNever(type);
    }
  }, 0);

  const neuronPositions = new Map<string, IPoint>();
  const objects: TNeuralNetworkLayoutObject[] = [];
  let offset = 0;

  for (const layer of layers) {
    if (layer.type === ELayerType.Axon) {
      offset += AXON_LENGTH + NEURON_MARGIN;
      continue;
    }

    const count = layer.neurons.length;

    const layerHeight = count * NEURON_DIAMETER + (count - 1) * NEURON_MARGIN;
    const layerOffset = (height - layerHeight) / 2;

    layer.neurons.forEach((neuron, index) => {
      const x = offset + NEURON_RADIUS;
      const y = layerOffset + NEURON_RADIUS + index * (NEURON_DIAMETER + NEURON_MARGIN);

      neuronPositions.set(neuron.id, { x, y });
      objects.push({
        ...neuron,
        type: ELayerType.Neuron,
        layerType: layer.neuronLayerType,
        x,
        y,
      });
    });

    offset += NEURON_DIAMETER + NEURON_MARGIN;
  }

  for (const layer of layers) {
    if (layer.type !== ELayerType.Axon) {
      continue;
    }

    layer.axons.forEach(axon => {
      const fromNeuron = neuronPositions.get(axon.from);
      const toNeuron = neuronPositions.get(axon.to);

      if (isNil(fromNeuron) || isNil(toNeuron)) {
        return;
      }

      const xLength = toNeuron.x - fromNeuron.x;
      const yLength = toNeuron.y - fromNeuron.y;

      const xOffset = NEURON_RADIUS + NEURON_MARGIN;
      const yOffset = (yLength * (NEURON_RADIUS + NEURON_MARGIN)) / xLength;

      objects.push({
        ...axon,
        type: ELayerType.Axon,
        fromX: fromNeuron.x + xOffset,
        fromY: fromNeuron.y + yOffset,
        toX: toNeuron.x - xOffset,
        toY: toNeuron.y - yOffset,
        neuronFromX: fromNeuron.x,
        neuronFromY: fromNeuron.y,
        neuronToX: toNeuron.x,
        neuronToY: toNeuron.y,
      });
    });
  }

  return { objects, width, height };
}

export function getNeuralNetworkOrigin(
  { width, height }: INeuralNetworkLayout,
  canvasWidth: number,
  canvasHeight: number
): IPoint {
  return {
    x: Math.floor((canvasWidth - width) / 2),
    y: Math.floor((canvasHeight - height) / 2),
  };
}

export function findNeuronAtPoint(
  layout: INeuralNetworkLayout,
  canvasWidth: number,
  canvasHeight: number,
  pointX: number,
  pointY: number
): INeuronLayoutObject | undefined {
  const origin = getNeuralNetworkOrigin(layout, canvasWidth, canvasHeight);

  for (const object of layout.objects) {
    if (object.type !== ELayerType.Neuron) {
      continue;
    }

    const distanceX = pointX - origin.x - object.x;
    const distanceY = pointY - origin.y - object.y;

    if (NEURON_SQUARE_RADIUS > distanceX ** 2 + distanceY ** 2) {
      return object;
    }
  }

  return undefined;
}
