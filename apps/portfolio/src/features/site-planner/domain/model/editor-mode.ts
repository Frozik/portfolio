import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';

import type { BuildingId } from './building';
import type { Building } from './building';
import type { BuildingLayerId } from './building-layers';
import type { PathId, SitePath } from './plot-objects';
import type { UtilityRoute, UtilityRouteId } from './routing';
import type { PlanTool, Selection, ShapeOwner } from './selection';

/**
 * What the editor has opened for deep editing: the plot (with the footprints
 * and the terrain marks), a path, a utility trench, or a building's own
 * anatomy — walls today, storeys and more per `building-editor.md`.
 */
export type EditTarget =
  | { readonly kind: 'site' }
  | { readonly kind: 'path'; readonly pathId: PathId }
  | { readonly kind: 'utilityRoute'; readonly routeId: UtilityRouteId }
  | { readonly kind: 'building'; readonly buildingId: BuildingId };

/**
 * The Blender-style two-level contract: a neutral view mode where whole
 * objects are placed and arranged, and an edit mode where one target opens up
 * while everything else dims and locks. See `modes.md` for the full design.
 */
export type EditorMode =
  | { readonly kind: 'view' }
  | { readonly kind: 'edit'; readonly target: EditTarget };

export const VIEW_MODE: EditorMode = { kind: 'view' };

const VIEW_TOOLS: readonly PlanTool[] = ['select', 'pan', 'tree', 'path', 'utility', 'measure'];
const SITE_EDIT_TOOLS: readonly PlanTool[] = [
  'select',
  'pan',
  'rectangle',
  'circle',
  'ellipse',
  'elevation',
  'path',
  'measure',
];
const PATH_EDIT_TOOLS: readonly PlanTool[] = ['select', 'pan'];
const ROUTE_EDIT_TOOLS: readonly PlanTool[] = ['select', 'pan'];
const BUILDING_EDIT_TOOLS: readonly PlanTool[] = ['select', 'pan', 'measure'];

export type EditTargetKind = EditTarget['kind'];

/**
 * A tool contributed by one editor rather than shared by the shell, namespaced
 * by the editor that owns it — `'building:wall'`. No {@link PlanTool} carries
 * a colon, so the two halves of {@link ActiveTool} stay distinguishable at
 * runtime by that one character.
 */
export type EditorToolId = `${EditTargetKind}:${string}`;

/** What the hand can hold: a shared tool of the shell, or one editor's own. */
export type ActiveTool = PlanTool | EditorToolId;

const EDITOR_TOOL_SEPARATOR = ':';

export function isPlanTool(tool: ActiveTool): tool is PlanTool {
  return !tool.includes(EDITOR_TOOL_SEPARATOR);
}

export interface EditorToolSpec {
  readonly id: EditorToolId;
  /** Active only inside the owning editor; must not shadow a shared hotkey. */
  readonly hotkey: string | undefined;
  /**
   * The layer the tool draws on (`layers.md`): it stands on the rail and
   * answers its key only while that layer is active. A tool of an editor
   * without layers carries none.
   */
  readonly layer?: BuildingLayerId;
}

/**
 * What one editor contributes to the toolbar: the shared tools it inherits, in
 * rail order, and its own tools shown after them. The object-editor registry
 * of `object-editors.md` — a future editor (the building's) is one more row,
 * never a new special case in the rail, the hotkeys or the controller.
 */
export interface ObjectEditorSpec {
  readonly sharedTools: readonly PlanTool[];
  readonly ownTools: readonly EditorToolSpec[];
}

export const OBJECT_EDITOR_SPECS: Readonly<Record<EditTargetKind, ObjectEditorSpec>> = {
  site: { sharedTools: SITE_EDIT_TOOLS, ownTools: [] },
  path: { sharedTools: PATH_EDIT_TOOLS, ownTools: [] },
  utilityRoute: { sharedTools: ROUTE_EDIT_TOOLS, ownTools: [] },
  building: {
    sharedTools: BUILDING_EDIT_TOOLS,
    ownTools: [
      { id: 'building:slab', hotkey: 'b', layer: 'structure' },
      { id: 'building:support', hotkey: 'g', layer: 'structure' },
      { id: 'building:wall', hotkey: 'w', layer: 'walls' },
      { id: 'building:opening', hotkey: 'o', layer: 'walls' },
      { id: 'building:stair', hotkey: 's', layer: 'walls' },
      { id: 'building:furniture', hotkey: 'f', layer: 'furniture' },
      { id: 'building:electric', hotkey: 'k', layer: 'electrical' },
      { id: 'building:connect', hotkey: 'l', layer: 'electrical' },
      { id: 'building:fireplace', hotkey: 'j', layer: 'services' },
      { id: 'building:duct', hotkey: 'd', layer: 'services' },
    ],
  },
};

/**
 * The tools the open editor contributes right now: its own tools, narrowed to
 * the active layer where the editor has layers. Nothing while viewing.
 */
export function editorOwnTools(
  mode: EditorMode,
  activeLayer: BuildingLayerId | undefined
): readonly EditorToolSpec[] {
  if (mode.kind === 'view') {
    return NO_OWN_TOOLS;
  }

  return OBJECT_EDITOR_SPECS[mode.target.kind].ownTools.filter(
    tool => isNil(tool.layer) || tool.layer === activeLayer
  );
}

const NO_OWN_TOOLS: readonly EditorToolSpec[] = [];

/**
 * The full toolbar of a mode, in the order the rail shows it. The toolbar, the
 * hotkeys and the interaction controller all read this one table, so a tool
 * can never be reachable by key in a mode whose rail does not carry it — nor
 * on a layer that does not own it.
 */
export function editorToolbar(
  mode: EditorMode,
  activeLayer: BuildingLayerId | undefined
): readonly ActiveTool[] {
  if (mode.kind === 'view') {
    return VIEW_TOOLS;
  }

  return [
    ...OBJECT_EDITOR_SPECS[mode.target.kind].sharedTools,
    ...editorOwnTools(mode, activeLayer).map(tool => tool.id),
  ];
}

/** The shared half of {@link editorToolbar}, for consumers that speak PlanTool. */
export function allowedPlanTools(mode: EditorMode): readonly PlanTool[] {
  return mode.kind === 'view' ? VIEW_TOOLS : OBJECT_EDITOR_SPECS[mode.target.kind].sharedTools;
}

export function isToolAllowed(
  mode: EditorMode,
  activeLayer: BuildingLayerId | undefined,
  tool: ActiveTool
): boolean {
  return editorToolbar(mode, activeLayer).includes(tool);
}

/** The open editor's own tool armed by this key, if the active layer carries one. */
export function editorToolForHotkey(
  mode: EditorMode,
  activeLayer: BuildingLayerId | undefined,
  key: string
): EditorToolId | undefined {
  return editorOwnTools(mode, activeLayer).find(tool => tool.hotkey === key)?.id;
}

/**
 * The selection an editor opens holding: the very object it is the editor of.
 * The site and building editors hold nothing — their world is picked inside.
 */
export function editedTargetSelection(target: EditTarget): Selection | undefined {
  switch (target.kind) {
    case 'path':
      return { kind: 'path', pathId: target.pathId };
    case 'utilityRoute':
      return { kind: 'utilityRoute', routeId: target.routeId };
    case 'site':
    case 'building':
      return undefined;
    default:
      return assertNever(target);
  }
}

/** The path being edited, when one is. */
export function editedPathId(mode: EditorMode): PathId | undefined {
  return mode.kind === 'edit' && mode.target.kind === 'path' ? mode.target.pathId : undefined;
}

/** The trench being edited, when one is. */
export function editedUtilityRouteId(mode: EditorMode): UtilityRouteId | undefined {
  return mode.kind === 'edit' && mode.target.kind === 'utilityRoute'
    ? mode.target.routeId
    : undefined;
}

export function isSiteEditMode(mode: EditorMode): boolean {
  return mode.kind === 'edit' && mode.target.kind === 'site';
}

/** The building whose own editor is open, when one is. */
export function editedBuildingId(mode: EditorMode): BuildingId | undefined {
  return mode.kind === 'edit' && mode.target.kind === 'building'
    ? mode.target.buildingId
    : undefined;
}

/**
 * How a selected object is opened for deep editing: the mode to enter, and —
 * for a building, whose anatomy lives inside site editing — the group the
 * editor arrives aimed at.
 */
export interface EditorDoor {
  readonly target: EditTarget;
  readonly aimAt: BuildingId | undefined;
}

/**
 * The one rule behind Enter, the double click and every «edit» button: which
 * editor a selection descends into, if any. Trees and cars have no anatomy to
 * open (`SITE_OBJECT_TRAITS`), and shapes, groups and marks already live
 * inside an editor.
 */
export function editorDoorFor(selection: Selection): EditorDoor | undefined {
  switch (selection.kind) {
    case 'path':
      return { target: { kind: 'path', pathId: selection.pathId }, aimAt: undefined };
    case 'utilityRoute':
      return {
        target: { kind: 'utilityRoute', routeId: selection.routeId },
        aimAt: undefined,
      };
    case 'building':
      // The building's own editor (walls and, in time, the rest of
      // `building-editor.md`); the footprint stays behind the site editor's door.
      return {
        target: { kind: 'building', buildingId: selection.buildingId },
        aimAt: undefined,
      };
    case 'shape':
    case 'group':
    case 'mark':
    case 'tree':
    case 'car':
    case 'wall':
    case 'opening':
    case 'furniture':
    case 'device':
    case 'stair':
    case 'support':
    case 'slab':
    case 'fireplace':
    case 'duct':
    case 'utilityEntry':
      return undefined;
    default:
      return assertNever(selection);
  }
}

/**
 * What the mode bar names next to its exit button — the always-visible answer
 * to "what am I editing". Site editing aimed at a building names the building,
 * because that is what the person descended into.
 */
export type EditedObjectDescriptor =
  | { readonly kind: 'site' }
  | { readonly kind: 'building'; readonly name: string }
  | { readonly kind: 'path'; readonly ordinal: number }
  | { readonly kind: 'utilityRoute'; readonly ordinal: number };

export function describeEditedObject(
  mode: EditorMode,
  {
    activeOwner,
    buildings,
    paths,
    utilityRoutes,
  }: {
    readonly activeOwner: ShapeOwner;
    readonly buildings: readonly Building[];
    readonly paths: readonly SitePath[];
    readonly utilityRoutes: readonly UtilityRoute[];
  }
): EditedObjectDescriptor | undefined {
  if (mode.kind === 'view') {
    return undefined;
  }

  if (mode.target.kind === 'path') {
    const { pathId } = mode.target;
    const index = paths.findIndex(path => path.id === pathId);

    return { kind: 'path', ordinal: Math.max(index + 1, 1) };
  }

  if (mode.target.kind === 'utilityRoute') {
    const { routeId } = mode.target;
    const index = utilityRoutes.findIndex(route => route.id === routeId);

    return { kind: 'utilityRoute', ordinal: Math.max(index + 1, 1) };
  }

  if (mode.target.kind === 'building') {
    const { buildingId } = mode.target;
    const building = buildings.find(candidate => candidate.id === buildingId);

    return { kind: 'building', name: building?.name ?? '' };
  }

  const building =
    activeOwner === 'boundary'
      ? undefined
      : buildings.find(candidate => candidate.id === activeOwner);

  return isNil(building) ? { kind: 'site' } : { kind: 'building', name: building.name };
}
