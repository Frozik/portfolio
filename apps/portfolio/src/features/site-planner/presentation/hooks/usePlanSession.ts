import { isNil } from 'lodash-es';
import type { RefObject } from 'react';
import { useEffect } from 'react';

import type { AttachPlanPointerInput } from '../../application/plan-session';
import { createPlanSession } from '../../application/plan-session';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { PLAN_LABELS } from '../planLabels';

/**
 * Ties the 2D plan session to the mounted canvas. Strict-mode's mount → cleanup
 * → mount cycle simply disposes and rebuilds it; the store outlives it, so no
 * plan data is lost in between.
 */
export function usePlanSession(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  store: SitePlannerStore,
  attachPointerInput: AttachPlanPointerInput
): void {
  useEffect(() => {
    const canvas = canvasRef.current;

    return isNil(canvas)
      ? undefined
      : createPlanSession({ canvas, store, labels: PLAN_LABELS, attachPointerInput });
  }, [canvasRef, store, attachPointerInput]);
}
