import { isNil } from 'lodash-es';
import type { RefObject } from 'react';
import { useEffect } from 'react';

import { PlanInteractionController } from '../../application/plan-interaction-controller';
import { runPlanRenderer } from '../../application/render/run-plan-renderer';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { attachPlanPointerInput } from '../../infrastructure/plan-pointer-input';
import { PLAN_LABELS } from '../planLabels';

/**
 * Ties the 2D render session and its input to the mounted canvas. Strict-mode's
 * mount → cleanup → mount cycle simply disposes and rebuilds both; the store
 * outlives them, so no plan data is lost in between.
 */
export function usePlanSession(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  store: SitePlannerStore
): void {
  useEffect(() => {
    const canvas = canvasRef.current;

    if (isNil(canvas)) {
      return undefined;
    }

    const session = runPlanRenderer({ canvas, store, labels: PLAN_LABELS });
    const controller = new PlanInteractionController({
      store,
      getViewport: session.getViewport,
    });
    const detachInput = attachPlanPointerInput({
      canvas,
      target: controller,
      getViewport: session.getViewport,
      setViewport: session.setViewport,
      isPanToolActive: () => store.activeTool === 'pan',
    });

    return () => {
      detachInput();
      controller.dispose();
      session.dispose();
    };
  }, [canvasRef, store]);
}
