import { assert } from '@frozik/utils/assert/assert';
import { memo, useEffect, useRef } from 'react';

/**
 * Ambient background for the nav drawer — a slow Conway's Game of Life
 * grid rendered at very low opacity. Reads as "something alive is ticking
 * quietly", never competes with the menu content. Classic wrap-around
 * torus rules, torus topology so we never lose colonies to edges.
 * Respects prefers-reduced-motion (single static frame) and pauses while
 * the tab is hidden.
 */

const DPR_MAX = 2;
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
      const idx = y * cols + x;
      const alive = (current[idx] ?? 0) === 1;
      const survives =
        alive && neighbors >= RULE_MIN_NEIGHBORS_SURVIVE && neighbors <= RULE_MAX_NEIGHBORS_SURVIVE;
      const born = !alive && neighbors === RULE_BIRTH_NEIGHBORS;
      next[idx] = survives || born ? 1 : 0;
    }
  }
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  grid: LifeGrid,
  cols: number,
  rows: number,
  widthPx: number,
  heightPx: number,
  color: string
): void {
  ctx.clearRect(0, 0, widthPx, heightPx);
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

export const GameOfLifeBackground = memo(() => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    assert(canvas !== null, 'canvas must be mounted');
    const ctx = canvas.getContext('2d');
    assert(ctx !== null, '2d context must be available');

    const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const color = readCssColor(VAR_ACCENT, FALLBACK_COLOR);

    let widthPx = canvas.clientWidth;
    let heightPx = canvas.clientHeight;
    let cols = Math.max(1, Math.floor(widthPx / CELL_SIZE_PX));
    let rows = Math.max(1, Math.floor(heightPx / CELL_SIZE_PX));
    let grid = makeGrid(cols, rows, SEED_DENSITY);
    let next = new Uint8Array(grid.length);

    const applySize = (): void => {
      widthPx = canvas.clientWidth;
      heightPx = canvas.clientHeight;
      if (widthPx === 0 || heightPx === 0) {
        return;
      }
      canvas.width = Math.round(widthPx * dpr);
      canvas.height = Math.round(heightPx * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.max(1, Math.floor(widthPx / CELL_SIZE_PX));
      rows = Math.max(1, Math.floor(heightPx / CELL_SIZE_PX));
      grid = makeGrid(cols, rows, SEED_DENSITY);
      next = new Uint8Array(grid.length);
      drawGrid(ctx, grid, cols, rows, widthPx, heightPx, color);
    };

    applySize();

    if (reduceMotion) {
      const handleReducedResize = (): void => {
        applySize();
      };
      window.addEventListener('resize', handleReducedResize);
      return () => {
        window.removeEventListener('resize', handleReducedResize);
      };
    }

    let rafHandle = 0;
    let running = true;
    let lastUpdateMs = 0;

    const tick = (timestamp: number): void => {
      if (timestamp - lastUpdateMs >= UPDATE_INTERVAL_MS) {
        stepLife(grid, next, cols, rows);
        const tmp = grid;
        grid = next;
        next = tmp;
        const live = countLive(grid);
        if (grid.length > 0 && live / grid.length < RESEED_DENSITY_THRESHOLD) {
          grid = makeGrid(cols, rows, SEED_DENSITY);
          next = new Uint8Array(grid.length);
        }
        drawGrid(ctx, grid, cols, rows, widthPx, heightPx, color);
        lastUpdateMs = timestamp;
      }
      if (running) {
        rafHandle = requestAnimationFrame(tick);
      }
    };

    rafHandle = requestAnimationFrame(tick);

    const handleResize = (): void => {
      applySize();
    };

    const handleVisibility = (): void => {
      if (document.hidden) {
        running = false;
        if (rafHandle !== 0) {
          cancelAnimationFrame(rafHandle);
          rafHandle = 0;
        }
        return;
      }
      if (!running) {
        running = true;
        rafHandle = requestAnimationFrame(tick);
      }
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      running = false;
      if (rafHandle !== 0) {
        cancelAnimationFrame(rafHandle);
      }
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />;
});
