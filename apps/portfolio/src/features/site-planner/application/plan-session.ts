import type { PlanInputTarget } from '../domain/view/plan-input';
import type { PlanViewport } from '../domain/view/plan-viewport';
import { PlanInteractionController } from './plan-interaction-controller';
import type { PlanLabels } from './render/plan-draw/plan-content';
import { runPlanRenderer } from './render/run-plan-renderer';
import type { SitePlannerStore } from './SitePlannerStore';

/** Binds the canvas and the keyboard to the interaction target; returns the detach. */
export type AttachPlanPointerInput = (params: {
  readonly canvas: HTMLCanvasElement;
  readonly target: PlanInputTarget;
  readonly getViewport: () => PlanViewport;
  readonly setViewport: (viewport: PlanViewport) => void;
  readonly isPanToolActive: () => boolean;
}) => VoidFunction;

/**
 * One visit of the 2D plan: the render session, the interaction controller over
 * it and the input adapter the shell supplies, torn down together.
 */
export function createPlanSession({
  canvas,
  store,
  labels,
  attachPointerInput,
}: {
  readonly canvas: HTMLCanvasElement;
  readonly store: SitePlannerStore;
  readonly labels: PlanLabels;
  readonly attachPointerInput: AttachPlanPointerInput;
}): VoidFunction {
  const session = runPlanRenderer({ canvas, store, labels });
  const controller = new PlanInteractionController({ store, getViewport: session.getViewport });
  const detachInput = attachPointerInput({
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
}
