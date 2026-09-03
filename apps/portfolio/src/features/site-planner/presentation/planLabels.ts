import type { PlanLabels } from '../application/render/plan-draw/draw-plan';
import { sitePlannerT } from './translations';

/** The captions the plan is drawn with, on screen and on an exported sheet alike. */
export const PLAN_LABELS: PlanLabels = {
  meterUnit: sitePlannerT.plan.meterUnit,
  northLabel: sitePlannerT.plan.northLabel,
  padLabelPrefix: sitePlannerT.plan.padLabelPrefix,
  entryLetters: sitePlannerT.plan.entryLetters,
  roomTypeNames: sitePlannerT.rooms.types,
  stairUp: sitePlannerT.stairs.up,
  squareMeterUnit: sitePlannerT.plan.squareMeterUnit,
};
