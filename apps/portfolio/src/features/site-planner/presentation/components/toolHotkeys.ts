import type { PlanTool } from '../../domain/model/selection';

/**
 * The letter each tool is reached by, as the palette advertises it — the keys
 * themselves are handled by the plan input layer. Typed against {@link PlanTool},
 * so a tool added to the palette without a letter fails to compile.
 */
export const TOOL_HOTKEYS: Record<PlanTool, string> = {
  select: 'V',
  pan: 'H',
  rectangle: 'R',
  circle: 'C',
  ellipse: 'I',
  elevation: 'E',
  tree: 'T',
  path: 'P',
  utility: 'N',
  measure: 'M',
};
