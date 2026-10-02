import { isNil } from 'lodash-es';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useRef } from 'react';

import type { ChartModel } from '../core/chart-model';
import { mountChart } from '../dom/mount-chart';
import { useChartStage } from './ChartStageProvider';

const CONTAINER_STYLE: CSSProperties = { position: 'relative' };
const CANVAS_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  touchAction: 'none',
};
const UNDERLYING_CANVAS_STYLE: CSSProperties = { ...CANVAS_STYLE, pointerEvents: 'none' };

/**
 * A chart on the nearest stage: one canvas per backend of the stack, bottom
 * first, the topmost taking the pointer. Mounts the model when the stage is
 * ready and takes it off on unmount (§9).
 */
export function Chart<TX>({
  model,
  className,
  'aria-label': ariaLabel,
}: {
  readonly model: ChartModel<TX>;
  readonly className?: string;
  readonly 'aria-label'?: string;
}): ReactNode {
  const state = useChartStage();
  const stage = state.status === 'ready' ? state.stage : undefined;
  const canvases = useRef(new Map<string, HTMLCanvasElement>());
  const backendIds = stage?.backendIds ?? [];
  const topBackend = backendIds.at(-1);

  useEffect(() => {
    const input = isNil(topBackend) ? undefined : canvases.current.get(topBackend);
    if (isNil(stage) || isNil(input)) {
      return undefined;
    }
    return mountChart(stage, model, { input, canvases: Object.fromEntries(canvases.current) });
  }, [stage, model, topBackend]);

  return (
    <div className={className} style={CONTAINER_STYLE} role="img" aria-label={ariaLabel}>
      {backendIds.map(backendId => (
        <canvas
          key={backendId}
          ref={canvas => {
            if (isNil(canvas)) {
              canvases.current.delete(backendId);
            } else {
              canvases.current.set(backendId, canvas);
            }
          }}
          style={backendId === topBackend ? CANVAS_STYLE : UNDERLYING_CANVAS_STYLE}
        />
      ))}
    </div>
  );
}
