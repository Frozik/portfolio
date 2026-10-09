import { assertNever } from '@frozik/utils/assert/assertNever';

import type { Cell } from './cell-grid';
import type { Random } from './random';

/** What an island is seeded as: its cells, measured from the lower left corner of its box. */
export interface Footprint {
  readonly width: number;
  readonly height: number;
  readonly cells: readonly Cell[];
}

/**
 * The original's boards, read off eight screenshots (2026-09-18), mix three
 * kinds of island on the very half-metre module this grid has: long ones
 * framing the screen's edges, free-standing blocks and bars grown by arms
 * into an L, T, Z or stair, and lozenges and octagons a cell or two across.
 * The endless course has no edge to frame, so the first two are one kind
 * here: `body`, a block or a bar, short or long, grown by arms; `islet` is
 * never grown. Limbs are two cells thick, now and then one. A `giant` is a
 * rare body seeded big and grown far, a landmark several screens of play
 * are laid round. Bodies and giants start now and then from a diagonal
 * staircase or a cross rather than a bar. Nothing is ever thicker than
 * `MAX_THICKNESS_CELLS`: a big island is big by its branches, never a
 * solid lump (2026-10-10, the user's call — discs and diamonds read as
 * blobs).
 */
export type IslandKind = 'body' | 'giant' | 'islet';

/** Rows of a footprint, bottom first, each one run of cells. */
interface Row {
  readonly from: number;
  readonly width: number;
}

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Limbs — bars and arms — are this many cells thick: a metre. */
export const LIMB_THICKNESS = 2;
/** No square bigger than this many cells a side lies wholly inside an island: a metre and a half. */
export const MAX_THICKNESS_CELLS = 3;
const BLOCK_CHANCE = 0.35;
const BLOCK_WIDTH: Range = { min: 3, max: 5 };
/** Bars run from short to the long framing shapes the original lays along its edges. */
const BAR_LENGTH: Range = { min: 3, max: 14 };
/** An islet's footprint, in cells: lozenges a cell thick and small octagons. */
const ISLET_SIZES: readonly (readonly [width: number, height: number])[] = [
  [2, 1],
  [3, 1],
  [4, 1],
  [1, 2],
  [1, 3],
  [2, 2],
  [3, 2],
  [2, 3],
];
/** How often a body or a giant starts from a staircase or a cross rather than a bar. */
const EXOTIC_BODY_CHANCE = 0.4;
const EXOTIC_GIANT_CHANCE = 0.6;
const GIANT_SPINE_LENGTH: Range = { min: 14, max: 26 };
const GIANT_SPINE_THICKNESSES: readonly number[] = [LIMB_THICKNESS, MAX_THICKNESS_CELLS];
/**
 * How far each step of a staircase overlaps the one under it, in cells: at
 * least one, to be joined by a side, and at most one short of the thickness
 * an island may have, so two steps together are never thicker than that.
 */
const STAIR_OVERLAP: Range = { min: 1, max: MAX_THICKNESS_CELLS - 1 };

type ExoticShape = 'staircase' | 'cross';

const EXOTIC_SHAPES: readonly ExoticShape[] = ['staircase', 'cross'];

interface ExoticScale {
  readonly stairSteps: Range;
  readonly stairLength: Range;
  readonly crossBar: Range;
}

const BODY_SCALE: ExoticScale = {
  stairSteps: { min: 3, max: 5 },
  stairLength: { min: 3, max: 5 },
  crossBar: { min: 6, max: 12 },
};

const GIANT_SCALE: ExoticScale = {
  stairSteps: { min: 6, max: 11 },
  stairLength: { min: 4, max: 7 },
  crossBar: { min: 14, max: 26 },
};

/** The shape a new island of the kind starts from, before any arm is grown. */
export function seedFootprint(random: Random, kind: IslandKind): Footprint {
  switch (kind) {
    case 'islet': {
      const [width, height] = random.pick(ISLET_SIZES);
      return rectangle(width, height);
    }
    case 'body':
      return random.chance(EXOTIC_BODY_CHANCE) ? exotic(random, BODY_SCALE) : bodyBar(random);
    case 'giant':
      return random.chance(EXOTIC_GIANT_CHANCE) ? exotic(random, GIANT_SCALE) : giantSpine(random);
    default:
      return assertNever(kind);
  }
}

/** A block as thick as an island may be, or a bar two cells thick. */
function bodyBar(random: Random): Footprint {
  const block = random.chance(BLOCK_CHANCE);
  const length = between(random, block ? BLOCK_WIDTH : BAR_LENGTH);
  return lying(random, rectangle(length, block ? MAX_THICKNESS_CELLS : LIMB_THICKNESS));
}

/** A long bar: the spine a giant grows from. */
function giantSpine(random: Random): Footprint {
  const length = between(random, GIANT_SPINE_LENGTH);
  return lying(random, rectangle(length, random.pick(GIANT_SPINE_THICKNESSES)));
}

function exotic(random: Random, scale: ExoticScale): Footprint {
  const shape = random.pick(EXOTIC_SHAPES);
  switch (shape) {
    case 'staircase': {
      const length = between(random, scale.stairLength);
      const shift = length - Math.min(between(random, STAIR_OVERLAP), length - 1);
      const steps = staircase(between(random, scale.stairSteps), length, shift);
      return mirrored(random, lying(random, steps));
    }
    case 'cross':
      return cross(random, between(random, scale.crossBar), between(random, scale.crossBar));
    default:
      return assertNever(shape);
  }
}

function between(random: Random, range: Range): number {
  return random.int(range.min, range.max);
}

function rectangle(width: number, height: number): Footprint {
  return fromRows(Array.from({ length: height }, () => ({ from: 0, width })));
}

/** Bars two cells thick, each laid `shift` cells along from the one under it and overlapping it. */
function staircase(steps: number, length: number, shift: number): Footprint {
  const rows: Row[] = [];
  for (let step = 0; step < steps; step += 1) {
    for (let row = 0; row < LIMB_THICKNESS; row += 1) {
      rows.push({ from: step * shift, width: length });
    }
  }
  return fromRows(rows);
}

/**
 * A bar `across` cells long laid over one `up` cells tall, crossing it
 * anywhere along both: a plus, a T or an L by where they meet.
 */
function cross(random: Random, across: number, up: number): Footprint {
  const barY = random.int(0, up - LIMB_THICKNESS);
  const barX = random.int(0, across - LIMB_THICKNESS);
  const rows: Row[] = [];
  for (let y = 0; y < up; y += 1) {
    const onBar = y >= barY && y < barY + LIMB_THICKNESS;
    rows.push(onBar ? { from: 0, width: across } : { from: barX, width: LIMB_THICKNESS });
  }
  return fromRows(rows);
}

function fromRows(rows: readonly Row[]): Footprint {
  const cells = rows.flatMap((row, y) =>
    Array.from({ length: row.width }, (_, index) => ({ x: row.from + index, y }))
  );
  return {
    width: Math.max(...rows.map(row => row.from + row.width)),
    height: rows.length,
    cells,
  };
}

/** The footprint as it is, or turned on its side. */
function lying(random: Random, footprint: Footprint): Footprint {
  if (random.chance(1 / 2)) {
    return footprint;
  }
  return {
    width: footprint.height,
    height: footprint.width,
    cells: footprint.cells.map(({ x, y }) => ({ x: y, y: x })),
  };
}

/** The footprint as it is, or flipped left to right: a staircase climbing either way. */
function mirrored(random: Random, footprint: Footprint): Footprint {
  if (random.chance(1 / 2)) {
    return footprint;
  }
  return {
    ...footprint,
    cells: footprint.cells.map(({ x, y }) => ({ x: footprint.width - 1 - x, y })),
  };
}
