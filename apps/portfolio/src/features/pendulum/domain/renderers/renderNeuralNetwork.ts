import { assertNever } from '@frozik/utils/assert/assertNever';
import { NEURON_MARGIN, NEURON_RADIUS } from '../neural-network/constants';
import type {
  IAxonLayoutObject,
  INeuralNetworkLayout,
  INeuronLayoutObject,
} from '../neural-network/layout';
import { getNeuralNetworkOrigin } from '../neural-network/layout';
import { ELayerType, ENeuronLayerType } from '../players/types';

const NEURON_FILL_COLORS: Record<ENeuronLayerType, string> = {
  [ENeuronLayerType.Input]: '#d4380d',
  [ENeuronLayerType.Hidden]: '#1677ff',
  [ENeuronLayerType.Output]: '#faad14',
};

const STROKE_COLOR = '#d9d9d9';
const STROKE_COLOR_SELECTED = '#ffffff';
const LABEL_BACKGROUND_COLOR = '#000000';
const LABEL_TEXT_COLOR = '#ffffff';

const LINE_THICKNESS = 2;
const LINE_THICKNESS_SELECTED = 4;
const TEXT_MARGIN = 4;
const WEIGHT_TEXT_FONT = '14px monospace';

export function renderNeuralNetwork(
  context: CanvasRenderingContext2D,
  {
    layout,
    canvasWidth,
    canvasHeight,
    selectedNeuronId,
  }: {
    layout: INeuralNetworkLayout;
    canvasWidth: number;
    canvasHeight: number;
    selectedNeuronId: string | undefined;
  }
) {
  context.clearRect(0, 0, canvasWidth, canvasHeight);

  context.save();

  const origin = getNeuralNetworkOrigin(layout, canvasWidth, canvasHeight);
  context.translate(origin.x, origin.y);

  for (const object of layout.objects) {
    const { type } = object;

    switch (type) {
      case ELayerType.Neuron: {
        drawNeuron(context, object, selectedNeuronId);
        break;
      }

      case ELayerType.Axon: {
        drawAxon(context, object, selectedNeuronId);
        break;
      }

      default:
        assertNever(type);
    }
  }

  for (const object of layout.objects) {
    const { type } = object;

    switch (type) {
      case ELayerType.Neuron: {
        drawNeuronBias(context, object, selectedNeuronId);
        break;
      }

      case ELayerType.Axon: {
        drawAxonWeight(context, object, selectedNeuronId);
        break;
      }

      default:
        assertNever(type);
    }
  }

  context.restore();
}

function drawNeuron(
  context: CanvasRenderingContext2D,
  neuron: INeuronLayoutObject,
  selectedNeuronId: string | undefined
) {
  const isSelected = selectedNeuronId === neuron.id;

  context.beginPath();
  context.arc(neuron.x, neuron.y, NEURON_RADIUS, 0, 2 * Math.PI);
  context.fillStyle = NEURON_FILL_COLORS[neuron.layerType];
  context.fill();
  context.lineWidth = isSelected ? LINE_THICKNESS_SELECTED : LINE_THICKNESS;
  context.strokeStyle = isSelected ? STROKE_COLOR_SELECTED : STROKE_COLOR;
  context.stroke();
}

function drawAxon(
  context: CanvasRenderingContext2D,
  axon: IAxonLayoutObject,
  selectedNeuronId: string | undefined
) {
  const isSelected = selectedNeuronId === axon.from || selectedNeuronId === axon.to;

  context.beginPath();
  context.moveTo(axon.fromX, axon.fromY);
  context.lineTo(axon.toX, axon.toY);
  context.lineWidth = isSelected ? LINE_THICKNESS_SELECTED : LINE_THICKNESS;
  context.strokeStyle = isSelected ? STROKE_COLOR_SELECTED : STROKE_COLOR;
  context.stroke();
}

function drawNeuronBias(
  context: CanvasRenderingContext2D,
  neuron: INeuronLayoutObject,
  selectedNeuronId: string | undefined
) {
  if (selectedNeuronId !== neuron.id || neuron.layerType === ENeuronLayerType.Input) {
    return;
  }

  context.font = WEIGHT_TEXT_FONT;

  const text = neuron.bias.toString();
  const { width, height } = measureLabel(context, text);

  drawLabel(context, text, {
    rectX: neuron.x - width / 2,
    rectY: neuron.y + NEURON_RADIUS + NEURON_MARGIN,
    textX: neuron.x - width / 2 + TEXT_MARGIN,
    textY: neuron.y + NEURON_RADIUS + NEURON_MARGIN + height + TEXT_MARGIN,
    width,
    height,
  });
}

function drawAxonWeight(
  context: CanvasRenderingContext2D,
  axon: IAxonLayoutObject,
  selectedNeuronId: string | undefined
) {
  if (selectedNeuronId !== axon.from && selectedNeuronId !== axon.to) {
    return;
  }

  context.font = WEIGHT_TEXT_FONT;

  const text = axon.weight.toString();
  const { width, height } = measureLabel(context, text);

  const isIncomingAxon = selectedNeuronId === axon.to;
  const anchorX = isIncomingAxon ? axon.neuronFromX : axon.neuronToX;
  const anchorY = isIncomingAxon ? axon.neuronFromY : axon.neuronToY;
  const textX = isIncomingAxon
    ? anchorX - width - NEURON_RADIUS - NEURON_MARGIN
    : anchorX + NEURON_RADIUS + NEURON_MARGIN;

  drawLabel(context, text, {
    rectX: textX - TEXT_MARGIN,
    rectY: anchorY - height / 2 - TEXT_MARGIN,
    textX,
    textY: anchorY + height / 2,
    width,
    height,
  });
}

function measureLabel(
  context: CanvasRenderingContext2D,
  text: string
): { width: number; height: number } {
  const { width, actualBoundingBoxAscent, actualBoundingBoxDescent } = context.measureText(text);

  return {
    width,
    height: Math.ceil(actualBoundingBoxAscent + actualBoundingBoxDescent),
  };
}

function drawLabel(
  context: CanvasRenderingContext2D,
  text: string,
  {
    rectX,
    rectY,
    textX,
    textY,
    width,
    height,
  }: {
    rectX: number;
    rectY: number;
    textX: number;
    textY: number;
    width: number;
    height: number;
  }
) {
  context.fillStyle = LABEL_BACKGROUND_COLOR;
  context.fillRect(rectX, rectY, width + 2 * TEXT_MARGIN, height + 2 * TEXT_MARGIN);

  context.fillStyle = LABEL_TEXT_COLOR;
  context.fillText(text, textX, textY);
}
