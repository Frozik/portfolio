import type { Vector2 } from '@frozik/utils/math/vector2';
import { clamp } from 'lodash-es';

import { COLUMN_CENTER_OFFSET_WU, FIELD_HEIGHT_WU, TERRAIN_COLUMN_COUNT } from '../constants';
import type { HeightSpan, PlayerId } from '../types';

/** One terrain column: dirt fills `[0, surfaceHeight)`. Gravity is absolute — a carve below the
 * surface drops everything above it instantly, so no voids or overhangs ever survive. */
export interface TerrainColumn {
  readonly surfaceHeight: number;
}

export type Heightfield = readonly TerrainColumn[];

export interface CarveResult {
  readonly field: Heightfield;
  readonly affectedColumns: readonly number[];
}

export interface TankFootprint {
  readonly playerId: PlayerId;
  readonly columnIndex: number;
  readonly positionY: number;
}

export interface TankFall {
  readonly playerId: PlayerId;
  readonly fromY: number;
  readonly toY: number;
  readonly fallDistanceWu: number;
}

export interface FillRegion {
  readonly firstColumn: number;
  readonly lastColumn: number;
  readonly levelWu: number;
}

/** Binary-search passes for a fill level; 40 halvings resolve the field height to ~1e-10 wu. */
const FILL_LEVEL_SEARCH_PASSES = 40;

function getSpanLength(span: HeightSpan): number {
  return Math.max(0, span.top - span.bottom);
}

function intersectSpan(span: HeightSpan, bounds: HeightSpan): HeightSpan {
  return {
    bottom: Math.max(span.bottom, bounds.bottom),
    top: Math.min(span.top, bounds.top),
  };
}

export function createFlatHeightfield(
  heightWu: number,
  columnCount: number = TERRAIN_COLUMN_COUNT
): Heightfield {
  return createHeightfield(Array.from({ length: columnCount }, () => heightWu));
}

export function createHeightfield(heights: readonly number[]): Heightfield {
  return heights.map(height => ({ surfaceHeight: clamp(height, 0, FIELD_HEIGHT_WU) }));
}

export function getColumnCount(field: Heightfield): number {
  return field.length;
}

export function getColumnIndexAt(field: Heightfield, positionX: number): number {
  return clamp(Math.floor(positionX), 0, getColumnCount(field) - 1);
}

function isColumnInside(field: Heightfield, columnIndex: number): boolean {
  return columnIndex >= 0 && columnIndex < getColumnCount(field);
}

/** Ground level of a column; columns outside the field read as the field floor. */
export function getSurfaceHeight(field: Heightfield, columnIndex: number): number {
  return field[clamp(columnIndex, 0, getColumnCount(field) - 1)]?.surfaceHeight ?? 0;
}

export function isSolidAt(field: Heightfield, positionX: number, positionY: number): boolean {
  const columnIndex = Math.floor(positionX);

  if (!isColumnInside(field, columnIndex) || positionY < 0) {
    return false;
  }

  return positionY < field[columnIndex].surfaceHeight;
}

function carveColumn(column: TerrainColumn, cut: HeightSpan): TerrainColumn {
  const clipped = intersectSpan(cut, { bottom: 0, top: column.surfaceHeight });

  if (getSpanLength(clipped) <= 0) {
    return column;
  }

  const isOpenToSky = cut.top >= column.surfaceHeight;

  return isOpenToSky
    ? { surfaceHeight: clipped.bottom }
    : { surfaceHeight: Math.max(0, column.surfaceHeight - getSpanLength(clipped)) };
}

function depositOnColumn(column: TerrainColumn, amountWu: number): TerrainColumn {
  if (amountWu <= 0) {
    return column;
  }

  return {
    ...column,
    surfaceHeight: Math.min(FIELD_HEIGHT_WU, column.surfaceHeight + amountWu),
  };
}

function applyPerColumn(
  field: Heightfield,
  firstColumn: number,
  lastColumn: number,
  transform: (column: TerrainColumn, columnIndex: number) => TerrainColumn
): CarveResult {
  const from = Math.max(0, Math.ceil(firstColumn));
  const to = Math.min(getColumnCount(field) - 1, Math.floor(lastColumn));

  if (to < from) {
    return { field, affectedColumns: [] };
  }

  const next = [...field];
  const affectedColumns: number[] = [];

  for (let columnIndex = from; columnIndex <= to; columnIndex++) {
    const updated = transform(field[columnIndex], columnIndex);

    if (updated !== field[columnIndex]) {
      next[columnIndex] = updated;
      affectedColumns.push(columnIndex);
    }
  }

  return affectedColumns.length === 0
    ? { field, affectedColumns: [] }
    : { field: next, affectedColumns };
}

function getCircleHalfChord(radiusWu: number, offsetFromCenter: number): number {
  const squared = radiusWu * radiusWu - offsetFromCenter * offsetFromCenter;

  return squared <= 0 ? 0 : Math.sqrt(squared);
}

export function carveCircle(field: Heightfield, center: Vector2, radiusWu: number): CarveResult {
  return applyPerColumn(field, center.x - radiusWu, center.x + radiusWu, (column, columnIndex) => {
    const halfChord = getCircleHalfChord(
      radiusWu,
      columnIndex + COLUMN_CENTER_OFFSET_WU - center.x
    );

    return carveColumn(column, { bottom: center.y - halfChord, top: center.y + halfChord });
  });
}

/**
 * The riot-charge shape: a triangular void that is deepest straight above the apex and tapers to
 * nothing at ±radius, which is what lets a buried tank clear a firing lane over itself.
 */
export function carveWedge(field: Heightfield, apex: Vector2, radiusWu: number): CarveResult {
  return applyPerColumn(field, apex.x - radiusWu, apex.x + radiusWu, (column, columnIndex) => {
    const wedgeHeight = radiusWu - Math.abs(columnIndex + COLUMN_CENTER_OFFSET_WU - apex.x);

    return carveColumn(column, { bottom: apex.y, top: apex.y + wedgeHeight });
  });
}

/**
 * Dropped dirt always lands on top of the column: loose material cannot hang in the air, so a
 * deposit's whole chord piles onto the surface even when the sphere was drawn below it.
 */
export function depositCircle(field: Heightfield, center: Vector2, radiusWu: number): CarveResult {
  return applyPerColumn(field, center.x - radiusWu, center.x + radiusWu, (column, columnIndex) =>
    depositOnColumn(
      column,
      2 * getCircleHalfChord(radiusWu, columnIndex + COLUMN_CENTER_OFFSET_WU - center.x)
    )
  );
}

export function depositWedge(field: Heightfield, apex: Vector2, radiusWu: number): CarveResult {
  return applyPerColumn(field, apex.x - radiusWu, apex.x + radiusWu, (column, columnIndex) =>
    depositOnColumn(column, radiusWu - Math.abs(columnIndex + COLUMN_CENTER_OFFSET_WU - apex.x))
  );
}

function measureFill(
  field: Heightfield,
  centerColumn: number,
  levelWu: number,
  maxHalfSpanColumns: number
): { readonly volumeWu: number; readonly firstColumn: number; readonly lastColumn: number } {
  const lastIndex = getColumnCount(field) - 1;
  const anchor = clamp(centerColumn, 0, lastIndex);
  let volumeWu = Math.max(0, levelWu - getSurfaceHeight(field, anchor));
  let firstColumn = anchor;
  let lastColumn = anchor;

  for (let offset = 1; offset <= maxHalfSpanColumns; offset++) {
    const columnIndex = anchor - offset;

    if (columnIndex < 0 || getSurfaceHeight(field, columnIndex) >= levelWu) {
      break;
    }

    volumeWu += levelWu - getSurfaceHeight(field, columnIndex);
    firstColumn = columnIndex;
  }

  for (let offset = 1; offset <= maxHalfSpanColumns; offset++) {
    const columnIndex = anchor + offset;

    if (columnIndex > lastIndex || getSurfaceHeight(field, columnIndex) >= levelWu) {
      break;
    }

    volumeWu += levelWu - getSurfaceHeight(field, columnIndex);
    lastColumn = columnIndex;
  }

  return { volumeWu, firstColumn, lastColumn };
}

/**
 * Level a given volume of liquid settles at around a column, together with the basin it wets.
 * Shared by liquid dirt (which becomes terrain) and napalm (which becomes a burning pool).
 */
export function computeFillRegion(
  field: Heightfield,
  centerColumn: number,
  volumeWu: number,
  maxHalfSpanColumns: number
): FillRegion {
  const anchor = clamp(centerColumn, 0, getColumnCount(field) - 1);
  const floorLevel = getSurfaceHeight(field, anchor);

  if (volumeWu <= 0) {
    return { firstColumn: anchor, lastColumn: anchor, levelWu: floorLevel };
  }

  let low = floorLevel;
  let high = FIELD_HEIGHT_WU;

  for (let pass = 0; pass < FILL_LEVEL_SEARCH_PASSES; pass++) {
    const middle = (low + high) / 2;

    if (measureFill(field, anchor, middle, maxHalfSpanColumns).volumeWu < volumeWu) {
      low = middle;
    } else {
      high = middle;
    }
  }

  const measured = measureFill(field, anchor, high, maxHalfSpanColumns);

  return { firstColumn: measured.firstColumn, lastColumn: measured.lastColumn, levelWu: high };
}

/** Liquid dirt: pours into the hollow around a column and freezes as new ground. */
export function fillHollows(
  field: Heightfield,
  centerColumn: number,
  volumeWu: number,
  maxHalfSpanColumns: number
): CarveResult {
  const region = computeFillRegion(field, centerColumn, volumeWu, maxHalfSpanColumns);

  return applyPerColumn(field, region.firstColumn, region.lastColumn, column =>
    depositOnColumn(column, Math.max(0, region.levelWu - column.surfaceHeight))
  );
}

export function getSolidVolume(field: Heightfield): number {
  return field.reduce((total, column) => total + column.surfaceHeight, 0);
}

/** Tanks ride the surface of their column; a collapse under one drops it and hurts it. */
export function computeTankFalls(
  field: Heightfield,
  tanks: readonly TankFootprint[]
): readonly TankFall[] {
  const falls: TankFall[] = [];

  for (const tank of tanks) {
    const groundHeight = getSurfaceHeight(field, tank.columnIndex);

    if (groundHeight >= tank.positionY) {
      continue;
    }

    falls.push({
      playerId: tank.playerId,
      fromY: tank.positionY,
      toY: groundHeight,
      fallDistanceWu: tank.positionY - groundHeight,
    });
  }

  return falls;
}

/** Which way a rolling body leaves a column: -1 downhill left, +1 downhill right, 0 at rest. */
export function getDownhillStep(field: Heightfield, columnIndex: number): number {
  const currentHeight = getSurfaceHeight(field, columnIndex);
  const leftHeight =
    columnIndex > 0 ? getSurfaceHeight(field, columnIndex - 1) : Number.POSITIVE_INFINITY;
  const rightHeight =
    columnIndex < getColumnCount(field) - 1
      ? getSurfaceHeight(field, columnIndex + 1)
      : Number.POSITIVE_INFINITY;

  if (leftHeight >= currentHeight && rightHeight >= currentHeight) {
    return 0;
  }

  return leftHeight <= rightHeight ? -1 : 1;
}

/** Where a rolling body ends up on bare terrain: the valley floor it slides into. */
export function findDownhillRestColumn(
  field: Heightfield,
  startColumn: number,
  maxTravelColumns: number
): number {
  let columnIndex = clamp(startColumn, 0, getColumnCount(field) - 1);

  for (let step = 0; step < maxTravelColumns; step++) {
    const direction = getDownhillStep(field, columnIndex);

    if (direction === 0) {
      return columnIndex;
    }

    columnIndex += direction;
  }

  return columnIndex;
}
