import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { BuildingId } from '../../domain/model/building';
import type { Slab } from '../../domain/model/slabs';
import type { PlanModifiers } from '../../domain/view/plan-input';
import type { InteractionContext } from './editor-interaction';
import { snapPointToGrid } from './grid-snapping';
import { ShapeGestures } from './shape-gestures';
import { pickSlab } from './storey-object-picking';

/**
 * The floor slabs of the open storey under the pointer: drawn out like any
 * shape on the plot, resized by their grips, dragged whole — and laid as a
 * default plate by a click that never moved.
 */
export class SlabGestures {
  private readonly context: InteractionContext;
  private readonly shapes: ShapeGestures<void>;

  constructor(context: InteractionContext, buildingId: BuildingId) {
    this.context = context;
    // Everything on a storey is drawn against walls that are already standing,
    // so the object snap is live without a modifier here — the OSNAP habit the
    // wall tool already follows. A slab is caught by the corners and side
    // middles of the storey BELOW as well as by its own storey's, which is what
    // makes «flush with the room downstairs» a gesture rather than four typed
    // numbers.
    this.shapes = new ShapeGestures<void>(context, {
      isSnapAlwaysLive: true,
      update: slab => context.store.storeyObjects.updateSlab(buildingId, slab),
      add: slab => {
        context.store.storeyObjects.addSlab(slab);
        context.store.tooling.finishPlacement();
      },
      snapPoints: excludedShapeId => context.store.storeyObjects.slabSnapPoints(excludedShapeId),
    });
  }

  hasActive(): boolean {
    return this.shapes.hasActive();
  }

  /** The armed primitive, dragged out on the floor. */
  beginDraw(planPoint: Vector2, modifiers: PlanModifiers): void {
    this.shapes.beginDraw(this.context.store.armedShapeTool, undefined, planPoint, modifiers);
  }

  /** The grips of the selected slab: turn, and the eight that resize it. */
  beginHandle(planPoint: Vector2): boolean {
    const slab = this.selectedSlab();

    return !isNil(slab) && this.shapes.beginHandle(slab, undefined, planPoint);
  }

  /** Takes hold of the slab under the pointer — the floor itself, dragged whole. */
  beginDrag(planPoint: Vector2, select: (slab: Slab) => void): boolean {
    const slab = pickSlab(this.context, planPoint);

    if (isNil(slab)) {
      return false;
    }

    select(slab);
    this.shapes.beginMove(slab, undefined, planPoint);

    return true;
  }

  move(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    return this.shapes.move(planPoint, modifiers);
  }

  release(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    if (!this.shapes.release(planPoint, modifiers)) {
      return false;
    }

    // A press and a release with nothing in between is the click that lays a
    // default plate; the gesture itself has nothing to commit.
    if (!this.context.hasPointerMoved() && this.context.store.activeTool === 'building:slab') {
      this.context.store.storeyObjects.placeSlabAt(
        snapPointToGrid(this.context.store, planPoint, modifiers)
      );
      this.context.store.tooling.finishPlacement();
    }

    return true;
  }

  cancel(): void {
    this.shapes.cancel();
  }

  /** The slab the selection names, resolved against the active storey. */
  private selectedSlab(): Slab | undefined {
    const { store } = this.context;
    const selection = store.selection;

    return selection?.kind === 'slab'
      ? store.storeyObjects.activeStoreySlabs.find(candidate => candidate.id === selection.slabId)
      : undefined;
  }
}
