import type { PlanTool } from '../domain/model/selection';

/** Metres are edited to the centimetre; the geometry pipeline resolves millimetres. */
export const METER_DECIMALS = 2;

/** A tenth of a degree over a 40 m side is under a centimetre — finer is noise. */
export const DEGREE_DECIMALS = 1;

/** Geographic coordinates are worth about a metre at the fourth decimal. */
export const COORDINATE_DECIMALS = 4;

/** The tool that puts objects on the plan; it places trees and cars alike. */
export const PLACED_OBJECT_TOOL = 'tree' satisfies PlanTool;

/** The tool that routes site trenches; one button armed with a system. */
export const UTILITY_TOOL = 'utility' satisfies PlanTool;

/** The glyph on a tool button, and the smaller one on a row of its flyout. */
export const TOOL_ICON_SIZE_PX = 18;
export const FLYOUT_ICON_SIZE_PX = 16;

/**
 * History group of the plot's north offset. Two panels type into it — the
 * compass card and the settings drawer — and they share the group so a bearing
 * typed in either stays one step to undo.
 */
export const NORTH_OFFSET_HISTORY_GROUP = 'settings:north-offset';
