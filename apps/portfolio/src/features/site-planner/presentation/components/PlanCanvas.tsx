import { cn } from '@frozik/components/components/cn';
import { observer } from 'mobx-react-lite';
import { useRef } from 'react';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { AttachPlanPointerInput } from '../hooks/usePlanSession';
import { usePlanSession } from '../hooks/usePlanSession';
import { sitePlannerT } from '../translations';
import { AnalysisPanel } from './AnalysisPanel';
import { ElevationMarkInput } from './ElevationMarkInput';

/**
 * Host of the 2D plan. Everything painted here comes from the render session, so
 * the component reads almost no observables and re-renders only when the active
 * tool changes the cursor — the React over the canvas is otherwise just the
 * field a freshly placed mark opens, which positions itself against the canvas
 * box.
 */
export const PlanCanvas = observer(
  ({
    store,
    attachPointerInput,
  }: {
    readonly store: SitePlannerStore;
    readonly attachPointerInput: AttachPlanPointerInput;
  }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    usePlanSession(canvasRef, store, attachPointerInput);

    return (
      <div className="relative min-h-0 w-full flex-1">
        <canvas
          ref={canvasRef}
          aria-label={sitePlannerT.plan.canvasLabel}
          className={cn(
            'absolute inset-0 block size-full touch-none rounded-2xl border border-white/10',
            store.activeTool === 'pan' && 'cursor-grab active:cursor-grabbing'
          )}
        />
        <ElevationMarkInput store={store} />
        <AnalysisPanel store={store} />
      </div>
    );
  }
);
