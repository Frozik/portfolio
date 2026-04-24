import { useFunction, useMouseAction } from '@frozik/components';
import {
  assertNever,
  isFailValueDescriptor,
  isLoadingValueDescriptor,
  matchValueDescriptor,
} from '@frozik/utils';
import { isNil } from 'lodash-es';
import { Bot } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useResizeObserver } from 'usehooks-ts';
import { OverlayLoader } from '../../../../shared/components/OverlayLoader';
import { ValueDescriptorFail } from '../../../../shared/components/ValueDescriptorFail';
import { Alert } from '../../../../shared/ui';
import { usePendulumStore } from '../../application/usePendulumStore';
import type {
  IAxonDescriptor,
  INeuronDescriptor,
  INeuronLayerDescriptor,
} from '../../domain/players/types';
import { ELayerType, ENeuronLayerType } from '../../domain/players/types';
import { pendulumT } from '../translations';
import commonStyles from './common.module.scss';

const NEURON_DIAMETER = 30;
const NEURON_RADIUS = NEURON_DIAMETER / 2;
const NEURON_SQUARE_RADIUS = NEURON_RADIUS ** 2;
const NEURON_MARGIN = 5;
const AXON_LENGTH = 150;
const LINE_THICKNESS = 2;
const LINE_THICKNESS_SELECTED = 4;
const TEXT_MARGIN = 4;
const WEIGHT_TEXT_FONT = '14px monospace';
const ICON_SIZE = 16;

export const DrawNeuralNetwork = observer(() => {
  const ref = useRef<HTMLDivElement>(null);
  const { width = 0, height = 0 } = useResizeObserver({
    ref: ref as React.RefObject<HTMLElement>,
    box: 'border-box',
  });

  const [context, setContext] = useState<CanvasRenderingContext2D>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (isNil(canvas)) {
      return;
    }
    setContext(canvas.getContext('2d', { alpha: false }) ?? undefined);
  }, []);

  const store = usePendulumStore();
  const robotVD = store.currentRobot;

  const layers = useMemo(
    () =>
      matchValueDescriptor(robotVD, {
        synced: ({ value: robot }) => robot.getModelDescription(),
        unsynced: () => undefined,
      }),
    [robotVD]
  );

  const { drawingObjects, neuralNetworkWidth, neuralNetworkHeight } = useMemo(() => {
    if (isNil(layers)) {
      return { drawingObjects: [], neuralNetworkWidth: 0, neuralNetworkHeight: 0 };
    }

    const maxSize = Math.max(
      ...layers
        .filter((layer): layer is INeuronLayerDescriptor => layer.type === ELayerType.Neuron)
        .map(({ neurons: { length } }) => length)
    );

    const height = maxSize * NEURON_DIAMETER + (maxSize - 1) * NEURON_MARGIN;
    const width = layers.reduce((acc, layer, index, { length }) => {
      const { type } = layer;

      if (index !== length - 1) {
        acc += NEURON_MARGIN;
      }

      switch (type) {
        case ELayerType.Neuron: {
          return acc + NEURON_DIAMETER;
        }

        case ELayerType.Axon: {
          return acc + AXON_LENGTH;
        }

        default:
          assertNever(type);
      }
    }, 0);

    const neuronIndexMap = new Map<string, { x: number; y: number }>();
    const drawingObjects: (
      | (INeuronDescriptor & {
          type: ELayerType.Neuron;
          layerType: ENeuronLayerType;
          x: number;
          y: number;
        })
      | (IAxonDescriptor & {
          type: ELayerType.Axon;
          fromX: number;
          fromY: number;
          toX: number;
          toY: number;
          neuronFromX: number;
          neuronFromY: number;
          neuronToX: number;
          neuronToY: number;
        })
    )[] = [];
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

        neuronIndexMap.set(neuron.id, { x, y });
        drawingObjects.push({
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
        const fromNeuron = neuronIndexMap.get(axon.from);
        const toNeuron = neuronIndexMap.get(axon.to);

        if (isNil(fromNeuron) || isNil(toNeuron)) {
          return;
        }

        const xLength = toNeuron.x - fromNeuron.x;
        const yLength = toNeuron.y - fromNeuron.y;

        const xOffset = NEURON_RADIUS + NEURON_MARGIN;
        const yOffset = (yLength * (NEURON_RADIUS + NEURON_MARGIN)) / xLength;

        const fromX = fromNeuron.x + xOffset;
        const fromY = fromNeuron.y + yOffset;
        const toX = toNeuron.x - xOffset;
        const toY = toNeuron.y - yOffset;

        drawingObjects.push({
          ...axon,
          type: ELayerType.Axon,
          fromX,
          fromY,
          toX,
          toY,
          neuronFromX: fromNeuron.x,
          neuronFromY: fromNeuron.y,
          neuronToX: toNeuron.x,
          neuronToY: toNeuron.y,
        });
      });
    }

    return { drawingObjects, neuralNetworkWidth: width, neuralNetworkHeight: height };
  }, [layers]);

  const [selectedNeuron, setSelectedNeuron] = useState<INeuronDescriptor | undefined>(undefined);

  useEffect(() => {
    if (isNil(context)) {
      return;
    }

    context.clearRect(0, 0, width, height);

    context.save();

    context.translate((width - neuralNetworkWidth) >> 1, (height - neuralNetworkHeight) >> 1);

    for (const drawingObject of drawingObjects) {
      const { type } = drawingObject;

      switch (type) {
        case ELayerType.Neuron: {
          const isSelected = selectedNeuron?.id === drawingObject.id;

          context.beginPath();
          context.arc(drawingObject.x, drawingObject.y, NEURON_RADIUS, 0, 2 * Math.PI);
          context.fillStyle =
            drawingObject.layerType === ENeuronLayerType.Input
              ? '#d4380d'
              : drawingObject.layerType === ENeuronLayerType.Output
                ? '#faad14'
                : '#1677ff';
          context.fill();
          context.lineWidth = isSelected ? LINE_THICKNESS_SELECTED : LINE_THICKNESS;
          context.strokeStyle = isSelected ? '#ffffff' : '#d9d9d9';
          context.stroke();
          break;
        }

        case ELayerType.Axon: {
          const isSelected =
            selectedNeuron?.id === drawingObject.from || selectedNeuron?.id === drawingObject.to;

          context.beginPath();
          context.moveTo(drawingObject.fromX, drawingObject.fromY);
          context.lineTo(drawingObject.toX, drawingObject.toY);
          context.lineWidth = isSelected ? LINE_THICKNESS_SELECTED : LINE_THICKNESS;
          context.strokeStyle = isSelected ? '#ffffff' : '#d9d9d9';
          context.stroke();

          break;
        }

        default:
          assertNever(type);
      }
    }

    for (const drawingObject of drawingObjects) {
      const { type } = drawingObject;

      switch (type) {
        case ELayerType.Neuron: {
          const isSelected = selectedNeuron?.id === drawingObject.id;

          if (!isSelected || drawingObject.layerType === ENeuronLayerType.Input) {
            break;
          }

          context.font = WEIGHT_TEXT_FONT;

          const text = drawingObject.bias.toString();
          const { width, actualBoundingBoxAscent, actualBoundingBoxDescent } =
            context.measureText(text);
          const height = Math.ceil(actualBoundingBoxAscent + actualBoundingBoxDescent);

          const rectWidth = width + 2 * TEXT_MARGIN;
          const rectHeight = height + 2 * TEXT_MARGIN;

          context.fillStyle = '#000000';
          context.fillRect(
            drawingObject.x - width / 2,
            drawingObject.y + NEURON_RADIUS + NEURON_MARGIN,
            rectWidth,
            rectHeight
          );

          context.fillStyle = '#ffffff';
          context.fillText(
            text,
            drawingObject.x - width / 2 + TEXT_MARGIN,
            drawingObject.y + NEURON_RADIUS + NEURON_MARGIN + height + TEXT_MARGIN
          );

          break;
        }

        case ELayerType.Axon: {
          const isSelected =
            selectedNeuron?.id === drawingObject.from || selectedNeuron?.id === drawingObject.to;

          if (!isSelected) {
            break;
          }

          context.font = WEIGHT_TEXT_FONT;

          const text = drawingObject.weight.toString();
          const { width, actualBoundingBoxAscent, actualBoundingBoxDescent } =
            context.measureText(text);
          const height = Math.ceil(actualBoundingBoxAscent + actualBoundingBoxDescent);

          const rectWidth = width + 2 * TEXT_MARGIN;
          const rectHeight = height + 2 * TEXT_MARGIN;

          const { rectX, rectY, textX, textY } =
            selectedNeuron?.id === drawingObject.to
              ? {
                  rectX:
                    drawingObject.neuronFromX - width - NEURON_RADIUS - NEURON_MARGIN - TEXT_MARGIN,
                  rectY: drawingObject.neuronFromY - height / 2 - TEXT_MARGIN,
                  textX: drawingObject.neuronFromX - width - NEURON_RADIUS - NEURON_MARGIN,
                  textY: drawingObject.neuronFromY + height / 2,
                }
              : {
                  rectX: drawingObject.neuronToX + NEURON_RADIUS + NEURON_MARGIN - TEXT_MARGIN,
                  rectY: drawingObject.neuronToY - height / 2 - TEXT_MARGIN,
                  textX: drawingObject.neuronToX + NEURON_RADIUS + NEURON_MARGIN,
                  textY: drawingObject.neuronToY + height / 2,
                };

          context.fillStyle = '#000000';
          context.fillRect(rectX, rectY, rectWidth, rectHeight);

          context.fillStyle = '#ffffff';
          context.fillText(text, textX, textY);

          break;
        }

        default:
          assertNever(type);
      }
    }

    context.restore();
  }, [
    context,
    drawingObjects,
    width,
    height,
    neuralNetworkWidth,
    neuralNetworkHeight,
    selectedNeuron,
  ]);

  useMouseAction(
    useFunction(({ x, y }) => {
      const offsetX = (width - neuralNetworkWidth) >> 1;
      const offsetY = (height - neuralNetworkHeight) >> 1;

      for (const drawingObject of drawingObjects) {
        if (drawingObject.type !== ELayerType.Neuron) {
          continue;
        }

        if (
          NEURON_SQUARE_RADIUS >
          (x - offsetX - drawingObject.x) ** 2 + (y - offsetY - drawingObject.y) ** 2
        ) {
          setSelectedNeuron(drawingObject);
          return;
        }
      }

      setSelectedNeuron(undefined);
    }),
    canvasRef
  );

  return (
    <div ref={ref} className={commonStyles.container}>
      <canvas
        ref={canvasRef}
        className={commonStyles.containerChildFill}
        width={width}
        height={height}
      />
      {matchValueDescriptor(robotVD, {
        synced: ({ value: robot }) => (
          <div className={commonStyles.descriptionWithRemoval}>
            <Bot size={ICON_SIZE} />

            {robot.name}
          </div>
        ),
        unsynced: vd => {
          if (isLoadingValueDescriptor(vd)) {
            return (
              <div className={commonStyles.alertContainer}>
                <OverlayLoader />
              </div>
            );
          }
          if (isFailValueDescriptor(vd)) {
            return <ValueDescriptorFail fail={vd.fail} />;
          }
          return (
            <div className={commonStyles.alertContainer}>
              <Alert message={pendulumT.neuralNetwork.selectRobotMessage} type="info" />
            </div>
          );
        },
      })}
    </div>
  );
});
