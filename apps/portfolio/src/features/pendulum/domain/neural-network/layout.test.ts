import type { TLayerDescriptor } from '../players/types';
import { ELayerType, ENeuronLayerType } from '../players/types';
import {
  AXON_LENGTH,
  NEURON_DIAMETER,
  NEURON_MARGIN,
  NEURON_RADIUS,
  NEURON_SQUARE_RADIUS,
} from './constants';
import type { IAxonLayoutObject, INeuronLayoutObject } from './layout';
import { buildNeuralNetworkLayout, findNeuronAtPoint, getNeuralNetworkOrigin } from './layout';

function createLayers(): TLayerDescriptor[] {
  return [
    {
      type: ELayerType.Neuron,
      neuronLayerType: ENeuronLayerType.Input,
      neurons: [
        { id: 'input-0', bias: 0 },
        { id: 'input-1', bias: 0 },
      ],
    },
    {
      type: ELayerType.Axon,
      axons: [
        { id: 'axon-0', from: 'input-0', to: 'output-0', weight: 0.5 },
        { id: 'axon-1', from: 'input-1', to: 'output-0', weight: -0.25 },
      ],
    },
    {
      type: ELayerType.Neuron,
      neuronLayerType: ENeuronLayerType.Output,
      neurons: [{ id: 'output-0', bias: 1 }],
    },
  ];
}

function getNeurons(objects: ReturnType<typeof buildNeuralNetworkLayout>['objects']) {
  return objects.filter(
    (object): object is INeuronLayoutObject => object.type === ELayerType.Neuron
  );
}

function getAxons(objects: ReturnType<typeof buildNeuralNetworkLayout>['objects']) {
  return objects.filter((object): object is IAxonLayoutObject => object.type === ELayerType.Axon);
}

describe('buildNeuralNetworkLayout', () => {
  it('returns an empty layout when there are no layers', () => {
    expect(buildNeuralNetworkLayout([])).toEqual({ objects: [], width: 0, height: 0 });
  });

  it('returns an empty layout when there are no neuron layers', () => {
    const layout = buildNeuralNetworkLayout([{ type: ELayerType.Axon, axons: [] }]);

    expect(layout).toEqual({ objects: [], width: 0, height: 0 });
  });

  it('sizes the network by the biggest neuron layer and the layers sequence', () => {
    const { width, height } = buildNeuralNetworkLayout(createLayers());

    expect(height).toBe(2 * NEURON_DIAMETER + NEURON_MARGIN);
    expect(width).toBe(2 * NEURON_DIAMETER + AXON_LENGTH + 2 * NEURON_MARGIN);
  });

  it('places neurons of every layer vertically centered', () => {
    const neurons = getNeurons(buildNeuralNetworkLayout(createLayers()).objects);

    expect(neurons.map(({ id, x, y }) => ({ id, x, y }))).toEqual([
      { id: 'input-0', x: NEURON_RADIUS, y: NEURON_RADIUS },
      {
        id: 'input-1',
        x: NEURON_RADIUS,
        y: NEURON_RADIUS + NEURON_DIAMETER + NEURON_MARGIN,
      },
      {
        id: 'output-0',
        x: NEURON_DIAMETER + NEURON_MARGIN + AXON_LENGTH + NEURON_MARGIN + NEURON_RADIUS,
        y: (NEURON_DIAMETER + NEURON_MARGIN) / 2 + NEURON_RADIUS,
      },
    ]);
  });

  it('keeps the layer type of every neuron', () => {
    const neurons = getNeurons(buildNeuralNetworkLayout(createLayers()).objects);

    expect(neurons.map(({ layerType }) => layerType)).toEqual([
      ENeuronLayerType.Input,
      ENeuronLayerType.Input,
      ENeuronLayerType.Output,
    ]);
  });

  it('shortens axons by the neuron radius so they start outside the neuron circle', () => {
    const [axon] = getAxons(buildNeuralNetworkLayout(createLayers()).objects);
    const neurons = getNeurons(buildNeuralNetworkLayout(createLayers()).objects);
    const [fromNeuron] = neurons;
    const toNeuron = neurons[neurons.length - 1];

    expect(axon.neuronFromX).toBe(fromNeuron.x);
    expect(axon.neuronToX).toBe(toNeuron.x);
    expect(axon.fromX).toBe(fromNeuron.x + NEURON_RADIUS + NEURON_MARGIN);
    expect(axon.toX).toBe(toNeuron.x - NEURON_RADIUS - NEURON_MARGIN);
    expect(axon.fromY).toBeGreaterThan(fromNeuron.y);
    expect(axon.toY).toBeLessThan(toNeuron.y);
  });

  it('skips axons referencing unknown neurons', () => {
    const layout = buildNeuralNetworkLayout([
      {
        type: ELayerType.Neuron,
        neuronLayerType: ENeuronLayerType.Input,
        neurons: [{ id: 'input-0', bias: 0 }],
      },
      {
        type: ELayerType.Axon,
        axons: [{ id: 'axon-0', from: 'input-0', to: 'missing', weight: 1 }],
      },
    ]);

    expect(getAxons(layout.objects)).toEqual([]);
  });

  it('keeps the weight and the bias of the described network', () => {
    const layout = buildNeuralNetworkLayout(createLayers());

    expect(getAxons(layout.objects).map(({ weight }) => weight)).toEqual([0.5, -0.25]);
    expect(getNeurons(layout.objects).map(({ bias }) => bias)).toEqual([0, 0, 1]);
  });
});

describe('getNeuralNetworkOrigin', () => {
  it('centers the network inside the canvas', () => {
    const layout = { objects: [], width: 100, height: 50 };

    expect(getNeuralNetworkOrigin(layout, 300, 150)).toEqual({ x: 100, y: 50 });
  });

  it('rounds the fractional offset down', () => {
    const layout = { objects: [], width: 100, height: 50 };

    expect(getNeuralNetworkOrigin(layout, 301, 151)).toEqual({ x: 100, y: 50 });
  });
});

describe('findNeuronAtPoint', () => {
  const layout = buildNeuralNetworkLayout(createLayers());
  const canvasWidth = layout.width;
  const canvasHeight = layout.height;

  it('finds the neuron under the pointer', () => {
    const [neuron] = getNeurons(layout.objects);

    expect(findNeuronAtPoint(layout, canvasWidth, canvasHeight, neuron.x, neuron.y)?.id).toBe(
      neuron.id
    );
  });

  it('takes the centering offset into account', () => {
    const [neuron] = getNeurons(layout.objects);

    expect(
      findNeuronAtPoint(layout, canvasWidth + 2 * NEURON_DIAMETER, canvasHeight, neuron.x, neuron.y)
    ).toBeUndefined();
    expect(
      findNeuronAtPoint(
        layout,
        canvasWidth + 2 * NEURON_DIAMETER,
        canvasHeight,
        neuron.x + NEURON_DIAMETER,
        neuron.y
      )?.id
    ).toBe(neuron.id);
  });

  it('returns undefined for a point outside of every neuron', () => {
    expect(
      findNeuronAtPoint(layout, canvasWidth, canvasHeight, -NEURON_DIAMETER, 0)
    ).toBeUndefined();
  });

  it('excludes the neuron border itself', () => {
    const [neuron] = getNeurons(layout.objects);

    expect(NEURON_SQUARE_RADIUS).toBe(NEURON_RADIUS ** 2);
    expect(
      findNeuronAtPoint(layout, canvasWidth, canvasHeight, neuron.x + NEURON_RADIUS, neuron.y)
    ).toBeUndefined();
  });
});
