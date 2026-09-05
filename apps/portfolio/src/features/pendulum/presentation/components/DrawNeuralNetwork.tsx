import { useFunction } from '@frozik/components/hooks/useFunction';
import { usePointerAction } from '@frozik/components/hooks/usePointerAction';
import {
  isFailValueDescriptor,
  isLoadingValueDescriptor,
  matchValueDescriptor,
} from '@frozik/utils/value-descriptors/utils';
import { isNil } from 'lodash-es';
import { Bot } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useResizeObserver } from 'usehooks-ts';
import { OverlayLoader } from '../../../../shared/components/OverlayLoader';
import { ValueDescriptorFail } from '../../../../shared/components/ValueDescriptorFail';
import { Alert } from '../../../../shared/ui/Alert';
import { usePendulumStore } from '../../application/usePendulumStore';
import { buildNeuralNetworkLayout, findNeuronAtPoint } from '../../domain/neural-network/layout';
import { OVERLAY_MESSAGE_CONTAINER_CLASS, PLAYER_LABEL_CLASS } from '../constants';
import { drawNeuralNetwork } from '../render/draw-neural-network';
import { pendulumT } from '../translations';

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
  const robot = store.selectedRobot;

  const layers = useMemo(
    () =>
      matchValueDescriptor(robot, {
        synced: ({ value }) => value.describeNetwork(),
        unsynced: () => undefined,
      }),
    [robot]
  );

  const layout = useMemo(() => buildNeuralNetworkLayout(layers ?? []), [layers]);

  const [selectedNeuronId, setSelectedNeuronId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (isNil(context)) {
      return;
    }

    drawNeuralNetwork(context, {
      layout,
      canvasWidth: width,
      canvasHeight: height,
      selectedNeuronId,
    });
  }, [context, layout, width, height, selectedNeuronId]);

  usePointerAction(
    useFunction(({ x, y }) => {
      setSelectedNeuronId(findNeuronAtPoint(layout, width, height, x, y)?.id);
    }),
    canvasRef
  );

  return (
    <div ref={ref} className="relative m-px h-full w-full">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 overflow-hidden"
        width={width}
        height={height}
      />
      {matchValueDescriptor(robot, {
        synced: ({ value }) => (
          <div className={PLAYER_LABEL_CLASS}>
            <Bot size={ICON_SIZE} />

            {value.name}
          </div>
        ),
        unsynced: vd => {
          if (isLoadingValueDescriptor(vd)) {
            return (
              <div className={OVERLAY_MESSAGE_CONTAINER_CLASS}>
                <OverlayLoader />
              </div>
            );
          }
          if (isFailValueDescriptor(vd)) {
            return <ValueDescriptorFail fail={vd.fail} />;
          }
          return (
            <div className={OVERLAY_MESSAGE_CONTAINER_CLASS}>
              <Alert message={pendulumT.neuralNetwork.selectRobotMessage} type="info" />
            </div>
          );
        },
      })}
    </div>
  );
});
