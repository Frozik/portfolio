import type { Vector2 } from '@frozik/utils/math/vector2';

import type { BuildingId } from '../../domain/model/building';
import type { PlanModifiers } from '../../domain/view/plan-input';
import type { InteractionContext } from './editor-interaction';
import { snapPointToGrid } from './grid-snapping';
import type { SlabGestures } from './slab-gestures';
import { connectDeviceAt, placeDeviceAt, placeOpeningAt } from './storey-object-placement';

/**
 * What a press does with each of the building editor's own tools in hand:
 * the runs (walls, cable routes) take one more corner, everything else lands
 * where it was clicked — one-shot for what is placed once, sticky for what
 * is placed in runs (R32). False for the shared tools the shell handles.
 */
export function placeWithBuildingTool(
  context: InteractionContext,
  buildingId: BuildingId,
  slabs: SlabGestures,
  planPoint: Vector2,
  modifiers: PlanModifiers
): boolean {
  const { store } = context;

  switch (store.activeTool) {
    case 'building:wall':
      // The ground storey stands on the foundation, so a click past the
      // slab lands on its edge; an upper storey may overhang (R24).
      // `draftWallCursor` is the previewed corner — angle lock and typed
      // length included — so what the rubber band showed is what lands.
      store.wallDraft.appendDraftWallPoint(
        store.walls.clampWallPoint(
          buildingId,
          store.wallDraft.draftWallCursor ?? store.wallDraft.firstWallPointAt(planPoint)
        )
      );
      store.wallDraft.setTypedLengthText(undefined);

      return true;
    case 'building:opening':
      // Nothing lands when the click missed every wall, and a tool that
      // placed nothing must stay in hand rather than quietly give up.
      if (placeOpeningAt(context, buildingId, planPoint)) {
        store.tooling.finishPlacement();
      }

      return true;
    case 'building:slab':
      // Drawn like any shape on the plot — the armed primitive, dragged out.
      // A click that never moved lays a plate of a sensible default size, so
      // the tool answers both ways of asking for a floor.
      slabs.beginDraw(planPoint, modifiers);

      return true;
    case 'building:fireplace':
      store.ducts.placeFireplaceAt(snapPointToGrid(store, planPoint, modifiers));
      store.tooling.finishPlacement();

      return true;
    case 'building:duct':
      store.ducts.placeDuctAt(snapPointToGrid(store, planPoint, modifiers));
      store.tooling.finishPlacement();

      return true;
    case 'building:support':
      store.storeyObjects.placeSupportAt(snapPointToGrid(store, planPoint, modifiers));
      store.tooling.finishPlacement();

      return true;
    case 'building:stair':
      // A stair is placed, not drawn: its run comes from the storey height,
      // so the click only says where.
      store.stairs.placeStairAt(snapPointToGrid(store, planPoint, modifiers));
      store.tooling.finishPlacement();

      return true;
    // Furniture and electrics are STICKY: a room is furnished and a storey
    // wired by placing one piece after another, so these two tools stay in
    // hand. The piece that lands is still selected, so its properties are
    // there to type — only the tool is not taken away.
    case 'building:furniture':
      store.furniture.placeFurnitureAt(buildingId, snapPointToGrid(store, planPoint, modifiers));

      return true;
    case 'building:electric':
      placeDeviceAt(context, buildingId, planPoint, modifiers);

      return true;
    case 'building:connect':
      connectDeviceAt(context, buildingId, planPoint);

      return true;
    case 'building:route':
      // Clicked out like a wall: the rubber band's end is what lands, so
      // what was previewed is what gets laid.
      store.electrics.wiring.appendDraftRoutePoint(
        store.electrics.wiring.draftRouteCursor ?? snapPointToGrid(store, planPoint, modifiers)
      );

      return true;
    default:
      return false;
  }
}
