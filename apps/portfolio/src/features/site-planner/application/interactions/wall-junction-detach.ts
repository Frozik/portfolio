import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { BuildingId } from '../../domain/model/building';
import type { JunctionEdge } from '../../domain/model/wall-topology';
import { edgeJunctionVertexIndex } from '../../domain/model/wall-topology';
import type { WallId } from '../../domain/model/walls';
import type { PlanModifiers } from '../../domain/view/plan-input';
import type { InteractionContext } from './editor-interaction';
import { snapPointToGrid } from './grid-snapping';
import { activeStoreyOf } from './storey-object-picking';

/** «D + цифра»: the edge's end torn off its junction, riding the pointer. */
interface DetachCarry {
  readonly wallId: WallId;
  readonly pointIndex: number;
  readonly restore: () => void;
}

/**
 * The break UI of the selected wall junction (the approved AutoCAD-style keys):
 * while a junction is selected, a digit removes that numbered edge, `D`+digit
 * tears it off the junction and hands its end to the pointer, `S` cuts the wall
 * in two right here, Escape backs out. These keys OUTRANK the tool hotkeys —
 * the controller delegates here first — or `s` and `d` would arm the stair and
 * duct tools instead.
 */
export class WallJunctionDetach {
  private readonly context: InteractionContext;
  private readonly buildingId: BuildingId;
  private carry: DetachCarry | undefined = undefined;
  /** The `D` half of «D + цифра» was pressed; the next digit detaches. */
  private isArmed = false;

  constructor(context: InteractionContext, buildingId: BuildingId) {
    this.context = context;
    this.buildingId = buildingId;
  }

  /** Whether an end is riding the pointer right now. */
  hasActive(): boolean {
    return !isNil(this.carry);
  }

  onKey(key: string): boolean {
    const { store } = this.context;

    if (!isNil(this.carry)) {
      if (key === 'Escape') {
        this.cancel();

        return true;
      }

      return false;
    }

    const junction = store.walls.selectedJunction;

    if (isNil(junction)) {
      return false;
    }

    if (key === 'Escape') {
      store.walls.selectJunction(undefined);
      this.isArmed = false;

      return true;
    }

    const lower = key.toLowerCase();

    if (lower === 'd') {
      this.isArmed = true;

      return true;
    }

    if (lower === 's') {
      store.walls.splitWallAtJunction(this.buildingId);
      this.isArmed = false;

      return true;
    }

    if (/^[1-9]$/.test(key)) {
      const edge = store.walls.selectedJunctionEdges[Number(key) - 1];

      if (!isNil(edge)) {
        if (this.isArmed) {
          this.begin(edge, junction);
        } else {
          store.walls.removeWallEdge(this.buildingId, edge.wallId, edge.segmentIndex);
        }
      }

      this.isArmed = false;

      return true;
    }

    return false;
  }

  /** The carried end follows the pointer, snapped and kept on the slab. */
  move(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const carry = this.carry;

    if (isNil(carry)) {
      return false;
    }

    this.moveCarriedEnd(carry, planPoint, modifiers);

    return true;
  }

  /** A press plants the carried end where it lands; nothing else answers. */
  plant(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const carry = this.carry;

    if (isNil(carry)) {
      return false;
    }

    this.carry = undefined;
    this.moveCarriedEnd(carry, planPoint, modifiers);
    this.context.store.walls.normalizeCrossings(this.buildingId);

    return true;
  }

  cancel(): void {
    const carry = this.carry;

    if (isNil(carry)) {
      return;
    }

    this.carry = undefined;
    carry.restore();
  }

  /** Tears the edge's end off the junction; the pointer carries it until a click plants it. */
  private begin(edge: JunctionEdge, junction: Vector2): void {
    const { store } = this.context;
    const storey = activeStoreyOf(this.context, this.buildingId);
    const wall = storey?.walls.find(candidate => candidate.id === edge.wallId);

    if (isNil(storey) || isNil(wall)) {
      return;
    }

    const pointIndex = edgeJunctionVertexIndex(wall, edge.segmentIndex, junction);

    if (isNil(pointIndex)) {
      return;
    }

    const snapshot = storey.walls;

    store.pushHistory();
    this.carry = {
      wallId: wall.id,
      pointIndex,
      restore: () => {
        for (const kept of snapshot) {
          store.walls.restoreWall(this.buildingId, kept);
        }
      },
    };
  }

  private moveCarriedEnd(carry: DetachCarry, planPoint: Vector2, modifiers: PlanModifiers): void {
    const { store } = this.context;

    store.walls.moveWallPoint(
      this.buildingId,
      carry.wallId,
      carry.pointIndex,
      store.walls.clampWallPoint(this.buildingId, snapPointToGrid(store, planPoint, modifiers))
    );
  }
}
