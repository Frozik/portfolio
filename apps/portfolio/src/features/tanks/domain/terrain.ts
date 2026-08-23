import { assert } from '@frozik/utils/assert/assert';
import { assertNever } from '@frozik/utils/assert/assertNever';

import { BULLET_IMPACT_STRIP_WIDTH_WU, CELL_QUADRANT_SIZE_WU, CELL_SIZE_WU } from './constants';
import { isHorizontalDirection } from './direction';
import type { FieldGeometry } from './field';
import { getFieldCellCount } from './field';
import type { Direction, QuadrantSelection, TerrainCell, TerrainKind } from './types';

const IMPACT_STRIP_CELL_COUNT = BULLET_IMPACT_STRIP_WIDTH_WU / CELL_SIZE_WU;

const NO_QUADRANTS: QuadrantSelection = {
  topLeft: false,
  topRight: false,
  bottomLeft: false,
  bottomRight: false,
};

const ALL_QUADRANTS: QuadrantSelection = {
  topLeft: true,
  topRight: true,
  bottomLeft: true,
  bottomRight: true,
};

/** The 4-wu-deep strips a bullet clears, chosen by flight axis and probe depth. */
const LEFT_COLUMN_QUADRANTS: QuadrantSelection = {
  topLeft: true,
  topRight: false,
  bottomLeft: true,
  bottomRight: false,
};

const RIGHT_COLUMN_QUADRANTS: QuadrantSelection = {
  topLeft: false,
  topRight: true,
  bottomLeft: false,
  bottomRight: true,
};

const TOP_ROW_QUADRANTS: QuadrantSelection = {
  topLeft: true,
  topRight: true,
  bottomLeft: false,
  bottomRight: false,
};

const BOTTOM_ROW_QUADRANTS: QuadrantSelection = {
  topLeft: false,
  topRight: false,
  bottomLeft: true,
  bottomRight: true,
};

export const EMPTY_CELL: TerrainCell = { kind: 'empty', ...NO_QUADRANTS };
export const BRICK_CELL: TerrainCell = { kind: 'brick', ...ALL_QUADRANTS };
export const STEEL_CELL: TerrainCell = { kind: 'steel', ...ALL_QUADRANTS };
export const WATER_CELL: TerrainCell = { kind: 'water', ...ALL_QUADRANTS };
export const ICE_CELL: TerrainCell = { kind: 'ice', ...ALL_QUADRANTS };
export const TREES_CELL: TerrainCell = { kind: 'trees', ...ALL_QUADRANTS };
export const EAGLE_CELL: TerrainCell = { kind: 'eagle', ...ALL_QUADRANTS };
const BORDER_CELL: TerrainCell = { kind: 'border', ...ALL_QUADRANTS };

export function createTerrainCell(kind: TerrainKind, quadrants: QuadrantSelection): TerrainCell {
  return { kind, ...quadrants };
}

export function hasAnyQuadrant(cell: TerrainCell): boolean {
  return cell.topLeft || cell.topRight || cell.bottomLeft || cell.bottomRight;
}

function hasAnyQuadrantIn(cell: TerrainCell, selection: QuadrantSelection): boolean {
  return (
    (cell.topLeft && selection.topLeft) ||
    (cell.topRight && selection.topRight) ||
    (cell.bottomLeft && selection.bottomLeft) ||
    (cell.bottomRight && selection.bottomRight)
  );
}

function withoutQuadrants(cell: TerrainCell, selection: QuadrantSelection): TerrainCell {
  const remaining: TerrainCell = {
    kind: cell.kind,
    topLeft: cell.topLeft && !selection.topLeft,
    topRight: cell.topRight && !selection.topRight,
    bottomLeft: cell.bottomLeft && !selection.bottomLeft,
    bottomRight: cell.bottomRight && !selection.bottomRight,
  };

  return hasAnyQuadrant(remaining) ? remaining : EMPTY_CELL;
}

export interface BulletImpact {
  readonly direction: Direction;
  /** Coordinate of the bullet's leading pixel along the flight axis. */
  readonly leadingEdgeWu: number;
  /** Center of the impact strip, perpendicular to the flight axis. */
  readonly perpendicularCenterWu: number;
  readonly piercing: boolean;
}

export interface BulletImpactResult {
  readonly blocked: boolean;
  readonly hitBorder: boolean;
  readonly hitSteel: boolean;
  readonly hitEagle: boolean;
  readonly destroyedTerrain: boolean;
}

const NO_IMPACT: BulletImpactResult = {
  blocked: false,
  hitBorder: false,
  hitSteel: false,
  hitEagle: false,
  destroyedTerrain: false,
};

const BORDER_IMPACT: BulletImpactResult = {
  blocked: true,
  hitBorder: true,
  hitSteel: false,
  hitEagle: false,
  destroyedTerrain: false,
};

function blocksTankKind(kind: TerrainKind): boolean {
  switch (kind) {
    case 'empty':
    case 'ice':
    case 'trees':
      return false;
    case 'brick':
    case 'steel':
    case 'water':
    case 'eagle':
    case 'border':
      return true;
    default:
      return assertNever(kind);
  }
}

function getProbedQuadrants(isHorizontalFlight: boolean, quadrantIndex: number): QuadrantSelection {
  if (isHorizontalFlight) {
    return quadrantIndex === 0 ? LEFT_COLUMN_QUADRANTS : RIGHT_COLUMN_QUADRANTS;
  }

  return quadrantIndex === 0 ? TOP_ROW_QUADRANTS : BOTTOM_ROW_QUADRANTS;
}

/** The 26 × 26 grid of 8-wu cells — the single source of truth for collision and damage. */
export class Terrain {
  readonly geometry: FieldGeometry;
  private readonly cells: TerrainCell[];
  private revisionCounter = 0;

  constructor(cells: readonly TerrainCell[], geometry: FieldGeometry) {
    const expectedCellCount = getFieldCellCount(geometry);

    assert(
      cells.length === expectedCellCount,
      `terrain must hold ${expectedCellCount} cells, got ${cells.length}`
    );

    this.geometry = geometry;
    this.cells = [...cells];
  }

  isInsideField(cellX: number, cellY: number): boolean {
    return (
      cellX >= 0 &&
      cellX < this.geometry.cellColumns &&
      cellY >= 0 &&
      cellY < this.geometry.cellRows
    );
  }

  /** Bumped on every mutation so renderers can rebuild their instance buffers lazily. */
  get revision(): number {
    return this.revisionCounter;
  }

  getCell(cellX: number, cellY: number): TerrainCell {
    if (!this.isInsideField(cellX, cellY)) {
      return BORDER_CELL;
    }

    return this.cells[cellY * this.geometry.cellColumns + cellX];
  }

  getKind(cellX: number, cellY: number): TerrainKind {
    return this.getCell(cellX, cellY).kind;
  }

  setCell(cellX: number, cellY: number, cell: TerrainCell): void {
    if (!this.isInsideField(cellX, cellY)) {
      return;
    }

    const index = cellY * this.geometry.cellColumns + cellX;
    if (this.cells[index] === cell) {
      return;
    }

    this.cells[index] = cell;
    this.revisionCounter++;
  }

  blocksTank(cellX: number, cellY: number): boolean {
    return blocksTankKind(this.getKind(cellX, cellY));
  }

  /** True when any cell overlapped by the box blocks tanks (partial brick still blocks). */
  isBoxBlockedForTank(positionX: number, positionY: number, sizeWu: number): boolean {
    return this.someCellInBox(positionX, positionY, sizeWu, (cellX, cellY) =>
      this.blocksTank(cellX, cellY)
    );
  }

  isBoxOverKind(positionX: number, positionY: number, sizeWu: number, kind: TerrainKind): boolean {
    return this.someCellInBox(
      positionX,
      positionY,
      sizeWu,
      (cellX, cellY) => this.getKind(cellX, cellY) === kind
    );
  }

  /** The strip is 4 wu deep for normal bullets and a whole 8-wu cell for piercing ones (§7). */
  applyBulletImpact(impact: BulletImpact): BulletImpactResult {
    const { direction, leadingEdgeWu, perpendicularCenterWu, piercing } = impact;

    const isHorizontalFlight = isHorizontalDirection(direction);
    const flightAxisSizeWu = isHorizontalFlight ? this.geometry.widthWu : this.geometry.heightWu;

    if (leadingEdgeWu < 0 || leadingEdgeWu >= flightAxisSizeWu) {
      return BORDER_IMPACT;
    }

    const alongCell = Math.floor(leadingEdgeWu / CELL_SIZE_WU);
    const quadrantIndex = Math.floor(
      (leadingEdgeWu - alongCell * CELL_SIZE_WU) / CELL_QUADRANT_SIZE_WU
    );
    const probedQuadrants = getProbedQuadrants(isHorizontalFlight, quadrantIndex);
    const stripStartCell = Math.round(perpendicularCenterWu / CELL_SIZE_WU) - 1;

    let blocked = false;
    let hitSteel = false;
    let hitEagle = false;
    let destroyedTerrain = false;

    for (let offset = 0; offset < IMPACT_STRIP_CELL_COUNT; offset++) {
      const perpendicularCell = stripStartCell + offset;
      const cellX = isHorizontalFlight ? alongCell : perpendicularCell;
      const cellY = isHorizontalFlight ? perpendicularCell : alongCell;

      if (!this.isInsideField(cellX, cellY)) {
        continue;
      }

      const cell = this.getCell(cellX, cellY);

      switch (cell.kind) {
        case 'empty':
        case 'water':
        case 'ice':
        case 'trees':
        case 'border':
          break;
        case 'brick': {
          if (piercing) {
            this.setCell(cellX, cellY, EMPTY_CELL);
            blocked = true;
            destroyedTerrain = true;
            break;
          }

          if (hasAnyQuadrantIn(cell, probedQuadrants)) {
            this.setCell(cellX, cellY, withoutQuadrants(cell, probedQuadrants));
            blocked = true;
            destroyedTerrain = true;
          }
          break;
        }
        case 'steel': {
          if (piercing) {
            this.setCell(cellX, cellY, EMPTY_CELL);
            destroyedTerrain = true;
          } else {
            hitSteel = true;
          }
          blocked = true;
          break;
        }
        case 'eagle': {
          hitEagle = true;
          blocked = true;
          break;
        }
        default:
          assertNever(cell.kind);
      }
    }

    if (!blocked) {
      return NO_IMPACT;
    }

    return { blocked, hitBorder: false, hitSteel, hitEagle, destroyedTerrain };
  }

  private someCellInBox(
    positionX: number,
    positionY: number,
    sizeWu: number,
    predicate: (cellX: number, cellY: number) => boolean
  ): boolean {
    const firstCellX = Math.floor(positionX / CELL_SIZE_WU);
    const lastCellX = Math.floor((positionX + sizeWu - 1) / CELL_SIZE_WU);
    const firstCellY = Math.floor(positionY / CELL_SIZE_WU);
    const lastCellY = Math.floor((positionY + sizeWu - 1) / CELL_SIZE_WU);

    for (let cellY = firstCellY; cellY <= lastCellY; cellY++) {
      for (let cellX = firstCellX; cellX <= lastCellX; cellX++) {
        if (predicate(cellX, cellY)) {
          return true;
        }
      }
    }

    return false;
  }
}
