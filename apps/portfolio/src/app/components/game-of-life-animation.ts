import type {
  IAmbientCanvasAnimation,
  IAmbientCanvasFrame,
  IAmbientCanvasResize,
} from '../../shared/hooks/useAmbientCanvas';

/**
 * Ambient background for the nav drawer — a slow Conway's Game of Life grid
 * rendered at very low opacity. Reads as "something alive is ticking quietly",
 * never competes with the menu content. Torus topology so colonies are never
 * lost to edges. Pure animation logic; the React shell lives in
 * `GameOfLifeBackground.tsx`.
 */

const CELL_SIZE_PX = 14;
const CELL_PADDING_PX = 1;
const UPDATE_INTERVAL_MS = 450;
const SEED_DENSITY = 0.28;
const RESEED_DENSITY_THRESHOLD = 0.04;
const ALIVE_ALPHA = 0.03;
const NEIGHBOR_OFFSETS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];
const RULE_MIN_NEIGHBORS_SURVIVE = 2;
const RULE_MAX_NEIGHBORS_SURVIVE = 3;
const RULE_BIRTH_NEIGHBORS = 3;
const VAR_ACCENT = '--color-landing-accent';
const FALLBACK_COLOR = '#74a8e7';

type LifeGrid = Uint8Array<ArrayBuffer>;

function makeGrid(cols: number, rows: number, density: number): LifeGrid {
  const grid = new Uint8Array(cols * rows);
  for (let index = 0; index < grid.length; index += 1) {
    grid[index] = Math.random() < density ? 1 : 0;
  }
  return grid;
}

function countLive(grid: LifeGrid): number {
  let count = 0;
  for (let index = 0; index < grid.length; index += 1) {
    count += grid[index] ?? 0;
  }
  return count;
}

function stepLife(current: LifeGrid, next: LifeGrid, cols: number, rows: number): void {
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      let neighbors = 0;
      for (const [dx, dy] of NEIGHBOR_OFFSETS) {
        const nx = (x + dx + cols) % cols;
        const ny = (y + dy + rows) % rows;
        neighbors += current[ny * cols + nx] ?? 0;
      }
      const cellIndex = y * cols + x;
      const alive = (current[cellIndex] ?? 0) === 1;
      const survives =
        alive && neighbors >= RULE_MIN_NEIGHBORS_SURVIVE && neighbors <= RULE_MAX_NEIGHBORS_SURVIVE;
      const born = !alive && neighbors === RULE_BIRTH_NEIGHBORS;
      next[cellIndex] = survives || born ? 1 : 0;
    }
  }
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  grid: LifeGrid,
  cols: number,
  rows: number,
  cssWidth: number,
  cssHeight: number,
  color: string
): void {
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  ctx.fillStyle = color;
  ctx.globalAlpha = ALIVE_ALPHA;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if ((grid[y * cols + x] ?? 0) === 1) {
        ctx.fillRect(
          x * CELL_SIZE_PX + CELL_PADDING_PX,
          y * CELL_SIZE_PX + CELL_PADDING_PX,
          CELL_SIZE_PX - CELL_PADDING_PX * 2,
          CELL_SIZE_PX - CELL_PADDING_PX * 2
        );
      }
    }
  }
  ctx.globalAlpha = 1;
}

function readCssColor(variable: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value.length > 0 ? value : fallback;
}

export function createGameOfLifeAnimation(): IAmbientCanvasAnimation {
  let cols = 1;
  let rows = 1;
  let grid: LifeGrid = new Uint8Array(1);
  let next: LifeGrid = new Uint8Array(1);
  let color = FALLBACK_COLOR;
  let sinceStepMs = 0;
  let repaintPending = true;

  const onResize = ({ ctx, cssWidth, cssHeight, dpr }: IAmbientCanvasResize): void => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    color = readCssColor(VAR_ACCENT, FALLBACK_COLOR);
    cols = Math.max(1, Math.floor(cssWidth / CELL_SIZE_PX));
    rows = Math.max(1, Math.floor(cssHeight / CELL_SIZE_PX));
    grid = makeGrid(cols, rows, SEED_DENSITY);
    next = new Uint8Array(grid.length);
    repaintPending = true;
  };

  const draw = (frame: IAmbientCanvasFrame): void => {
    let stepped = false;
    if (!frame.isStatic) {
      sinceStepMs += frame.deltaMs;
      if (sinceStepMs >= UPDATE_INTERVAL_MS) {
        sinceStepMs = 0;
        stepLife(grid, next, cols, rows);
        const swap = grid;
        grid = next;
        next = swap;
        if (grid.length > 0 && countLive(grid) / grid.length < RESEED_DENSITY_THRESHOLD) {
          grid = makeGrid(cols, rows, SEED_DENSITY);
          next = new Uint8Array(grid.length);
        }
        stepped = true;
      }
    }
    // The backing store persists between frames, so repaint only when the grid
    // changed or the store was just cleared by a resize/static frame.
    if (stepped || repaintPending || frame.isStatic) {
      repaintPending = false;
      drawGrid(frame.ctx, grid, cols, rows, frame.cssWidth, frame.cssHeight, color);
    }
  };

  return { draw, onResize };
}
