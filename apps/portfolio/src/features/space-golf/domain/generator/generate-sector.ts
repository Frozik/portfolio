import type { Vector2 } from '@frozik/utils/math/vector2';

import { CELL_METERS, FLOATER_CLEARANCE_METERS } from '../constants';
import type { Bounds, Floater, Rod, SpikeRow, Wall } from '../level';
import { rodSeat } from '../rods';
import { applySurfaces } from '../surfaces';
import { moveFloater, moveRod, moveSpikeRow, moveWall } from '../translate';
import type { Cell } from './cell-grid';
import { ISLAND_GAP_CELLS } from './island';
import { createLayout } from './layout';
import { placeFloaters } from './place-floaters';
import { placeRods } from './place-rods';
import { placeSpikes } from './place-spikes';
import { placeSurfaces } from './place-surfaces';
import { createRandom } from './random';

/** How far an island may reach into the sectors next door, in cells: no ruler-cut islands, no empty lanes along the borders. */
export const SECTOR_OVERHANG_CELLS = 6;
/** The window a sector is laid out in reaches this far past it: the overhang and the gap to whatever stands beyond. */
const MARGIN_CELLS = SECTOR_OVERHANG_CELLS + ISLAND_GAP_CELLS;
/** How many sectors away a standing sector can still reach into this one's window. */
export const NEIGHBOUR_REACH_SECTORS = 1;
/** A floater or a point to keep clear is kept clear as a blob of cells this far round it. */
const KEEP_CLEAR_METERS = FLOATER_CLEARANCE_METERS / 2;
const ROD_SAMPLE_METERS = CELL_METERS;
/** Nowhere near anything: the tee of a sector that has none. */
const NO_TEE: Vector2 = { x: -1e6, y: -1e6 };

/** A sector's size in half-metre cells; one size for the whole world, fixed when the world is made. */
export interface SectorSize {
  readonly widthCells: number;
  readonly heightCells: number;
}

/** A rectangle of the endless plane with everything that was made in it, in world metres. */
export interface Sector {
  readonly sx: number;
  readonly sy: number;
  readonly walls: readonly Wall[];
  readonly spikes: readonly SpikeRow[];
  readonly floaters: readonly Floater[];
  readonly rods: readonly Rod[];
  /** The cells of its islands, in world cells: what the sectors made after it must keep their gap from. */
  readonly cells: readonly Cell[];
  /** Where the very first ball starts; only the first sector of a new world has one. */
  readonly tee: Vector2 | undefined;
}

export function sectorKey(sx: number, sy: number): string {
  return `${sx},${sy}`;
}

/** The sector's own ground in world metres. */
export function sectorBounds(size: SectorSize, sx: number, sy: number): Bounds {
  const width = size.widthCells * CELL_METERS;
  const height = size.heightCells * CELL_METERS;
  return {
    min: { x: sx * width, y: sy * height },
    max: { x: (sx + 1) * width, y: (sy + 1) * height },
  };
}

/** Which sector a point of the plane lies in. */
export function sectorAt(
  size: SectorSize,
  point: Vector2
): { readonly sx: number; readonly sy: number } {
  return {
    sx: Math.floor(point.x / (size.widthCells * CELL_METERS)),
    sy: Math.floor(point.y / (size.heightCells * CELL_METERS)),
  };
}

export interface SectorRequest {
  readonly worldSeed: number;
  /** Holes played when the sector is made: the country beyond the kept sectors is new after every hole. */
  readonly epoch: number;
  readonly sx: number;
  readonly sy: number;
  readonly size: SectorSize;
  /** The sectors already standing within reach: their islands, floaters and rods are kept clear of. */
  readonly neighbours: readonly Sector[];
  /** Points no island may grow over: the ball where it lies. */
  readonly keepClear: readonly Vector2[];
  readonly withTee: boolean;
}

/**
 * A sector made in a window of its own, a margin wider than itself all
 * round, in which whatever already stands next door is an obstacle: its
 * islands are seeded on its own ground and may reach the overhang into its
 * neighbours', keeping the usual gap from theirs. Laid out in the window's
 * own coordinates by the placers the single board had, then moved to where
 * it lies in the world. What comes out depends on what stood there when it
 * was made — on the order the player uncovered the world in — and on
 * nothing else.
 */
export function generateSector(request: SectorRequest): Sector {
  const { sx, sy, size } = request;
  const random = createRandom(`${request.worldSeed}/${request.epoch}/${sx}/${sy}`);
  const originCell: Cell = {
    x: sx * size.widthCells - MARGIN_CELLS,
    y: sy * size.heightCells - MARGIN_CELLS,
  };
  const toWorld: Vector2 = { x: originCell.x * CELL_METERS, y: originCell.y * CELL_METERS };
  const toWindow: Vector2 = { x: -toWorld.x, y: -toWorld.y };
  const widthCells = size.widthCells + 2 * MARGIN_CELLS;
  const heightCells = size.heightCells + 2 * MARGIN_CELLS;
  const region: Bounds = {
    min: { x: MARGIN_CELLS * CELL_METERS, y: MARGIN_CELLS * CELL_METERS },
    max: {
      x: (MARGIN_CELLS + size.widthCells) * CELL_METERS,
      y: (MARGIN_CELLS + size.heightCells) * CELL_METERS,
    },
  };

  const theirWalls = request.neighbours.flatMap(each =>
    each.walls.map(wall => moveWall(wall, toWindow))
  );
  const theirSpikes = request.neighbours.flatMap(each =>
    each.spikes.map(row => moveSpikeRow(row, toWindow))
  );
  const theirFloaters = request.neighbours.flatMap(each =>
    each.floaters.map(floater => moveFloater(floater, toWindow))
  );
  const theirRods = request.neighbours.flatMap(each =>
    each.rods.map(rod => moveRod(rod, toWindow))
  );
  const keepClear = request.keepClear.map(point => ({
    x: point.x + toWindow.x,
    y: point.y + toWindow.y,
  }));

  const obstacles: Cell[] = [
    ...request.neighbours.flatMap(each =>
      each.cells.map(cell => ({ x: cell.x - originCell.x, y: cell.y - originCell.y }))
    ),
    ...[...theirFloaters.map(floater => floater.center), ...keepClear].flatMap(blobOf),
    ...theirRods.flatMap(pathCells),
  ];

  const layout = createLayout(random, {
    widthCells,
    heightCells,
    region: {
      x: MARGIN_CELLS,
      y: MARGIN_CELLS,
      width: size.widthCells,
      height: size.heightCells,
    },
    overhangCells: SECTOR_OVERHANG_CELLS,
    obstacles,
    withTee: request.withTee,
  });
  const walls = applySurfaces(layout.walls, placeSurfaces(random, layout.walls, layout.grid));
  const tee = layout.tee ?? NO_TEE;
  const spikes = placeSpikes(
    random,
    walls,
    { width: widthCells * CELL_METERS, height: heightCells * CELL_METERS },
    tee
  );
  const avoid = [...keepClear, tee];
  const floaters = placeFloaters(
    random,
    [...walls, ...theirWalls],
    region,
    avoid,
    theirFloaters,
    theirRods
  );
  const rods = placeRods(
    random,
    {
      walls,
      neighbourWalls: theirWalls,
      spikes: [...spikes, ...theirSpikes],
      floaters: [...floaters, ...theirFloaters],
    },
    avoid,
    theirRods
  );

  return {
    sx,
    sy,
    walls: walls.map(wall => moveWall(wall, toWorld)),
    spikes: spikes.map(row => moveSpikeRow(row, toWorld)),
    floaters: floaters.map(floater => moveFloater(floater, toWorld)),
    rods: rods.map(rod => moveRod(rod, toWorld)),
    cells: layout.cells.map(cell => ({ x: cell.x + originCell.x, y: cell.y + originCell.y })),
    tee:
      layout.tee === undefined
        ? undefined
        : { x: layout.tee.x + toWorld.x, y: layout.tee.y + toWorld.y },
  };
}

/** The cells round a point that an island must not grow over. */
function blobOf(point: Vector2): readonly Cell[] {
  const reach = Math.ceil(KEEP_CLEAR_METERS / CELL_METERS);
  const center = { x: Math.floor(point.x / CELL_METERS), y: Math.floor(point.y / CELL_METERS) };
  const cells: Cell[] = [];
  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      cells.push({ x: center.x + dx, y: center.y + dy });
    }
  }
  return cells;
}

/** The cells a rod's path runs through: nothing may grow across a bridge. */
function pathCells(rod: Rod): readonly Cell[] {
  const seat = rodSeat(rod);
  const length = Math.hypot(seat.x - rod.base.x, seat.y - rod.base.y);
  const cells: Cell[] = [];
  for (let along = ROD_SAMPLE_METERS; along < length; along += ROD_SAMPLE_METERS) {
    cells.push({
      x: Math.floor((rod.base.x + rod.direction.x * along) / CELL_METERS),
      y: Math.floor((rod.base.y + rod.direction.y * along) / CELL_METERS),
    });
  }
  return cells;
}
