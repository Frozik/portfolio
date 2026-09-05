import type { ActiveTool } from '../../domain/model/editor-mode';
import { isPlanTool } from '../../domain/model/editor-mode';
import type { PlanTool } from '../../domain/model/selection';
import { sitePlannerT } from '../translations';
import { EDITOR_TOOL_PRESENTATIONS } from './editorTools';

/**
 * One-line guidance for the tool in hand, shown in the status bar and in the
 * empty properties panel. Typed against {@link PlanTool}, so a tool added to the
 * palette without a hint fails to compile rather than showing nothing.
 */
const TOOL_HINTS: Record<PlanTool, string> = sitePlannerT.status.hints;

/** The hint for whatever is in hand — a shared tool's or a contributed one's. */
export function toolHint(tool: ActiveTool): string {
  return isPlanTool(tool) ? TOOL_HINTS[tool] : (EDITOR_TOOL_PRESENTATIONS[tool]?.hint ?? '');
}
