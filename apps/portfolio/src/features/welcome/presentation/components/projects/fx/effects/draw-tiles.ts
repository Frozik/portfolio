import type { IFxDrawContext } from '../types';

const ROW_COUNT = 7;
const COLUMN_COUNT = 9;
const HORIZON_RATIO = 0.12;
const GROUND_RATIO = 0.96;
/** How much narrower a row gets per step toward the horizon. */
const PERSPECTIVE_SHRINK = 0.78;
const NEAR_CELL_WIDTH_RATIO = 0.19;
const CHECKER_DARK_ALPHA = 0.08;
const CHECKER_LIGHT_ALPHA = 0.16;
const LOADED_ALPHA = 0.55;
const LINE_ALPHA = 0.28;
const LOAD_PERIOD_SECONDS = 7;
const LOAD_SWEEP_SECONDS = 4;
const FADE_SECONDS = 0.5;
const FOG_POWER = 1.6;
const HASH_ROW_STRIDE = 7.13;
const HASH_COLUMN_STRIDE = 3.71;
const HASH_SCALE = 43758.5453;
const CELL_GAP_PX = 0.6;

/** Deterministic 0..1 noise per cell so tiles land in a scattered, repeatable order. */
function cellNoise(row: number, column: number): number {
  const seed = Math.sin(row * HASH_ROW_STRIDE + column * HASH_COLUMN_STRIDE) * HASH_SCALE;
  return seed - Math.floor(seed);
}

function rowY(row: number, height: number): number {
  const horizon = height * HORIZON_RATIO;
  const ground = height * GROUND_RATIO;
  const depth = 1 - PERSPECTIVE_SHRINK ** row;
  const depthSpan = 1 - PERSPECTIVE_SHRINK ** ROW_COUNT;
  return ground - (ground - horizon) * (depth / depthSpan);
}

/**
 * A tilted tile grid running toward a foggy horizon: near tiles are big,
 * far ones small, and they fill in from the camera outward over a
 * checkerboard, nearest first, then the sweep starts over.
 */
export function drawTiles({
  ctx,
  width,
  height,
  time,
  accent,
  devicePixelRatio,
}: IFxDrawContext): void {
  const cycle = time % LOAD_PERIOD_SECONDS;
  const centerX = width / 2;
  const gap = CELL_GAP_PX * devicePixelRatio;

  for (let row = 0; row < ROW_COUNT; row++) {
    const near = rowY(row, height);
    const far = rowY(row + 1, height);
    const nearScale = PERSPECTIVE_SHRINK ** row;
    const farScale = PERSPECTIVE_SHRINK ** (row + 1);
    const nearCell = width * NEAR_CELL_WIDTH_RATIO * nearScale;
    const farCell = width * NEAR_CELL_WIDTH_RATIO * farScale;
    const fog = (1 - row / ROW_COUNT) ** FOG_POWER;

    for (let column = 0; column < COLUMN_COUNT; column++) {
      const offset = column - (COLUMN_COUNT - 1) / 2;
      const loadAt = (row / ROW_COUNT) * LOAD_SWEEP_SECONDS + cellNoise(row, column);
      const loaded = Math.min(1, Math.max(0, (cycle - loadAt) / FADE_SECONDS));
      const checker = (row + column) % 2 === 0 ? CHECKER_DARK_ALPHA : CHECKER_LIGHT_ALPHA;
      const alpha = (checker + (LOADED_ALPHA - checker) * loaded) * fog;

      ctx.fillStyle = accent(alpha);
      ctx.beginPath();
      ctx.moveTo(centerX + (offset - 0.5) * nearCell + gap, near - gap);
      ctx.lineTo(centerX + (offset + 0.5) * nearCell - gap, near - gap);
      ctx.lineTo(centerX + (offset + 0.5) * farCell - gap, far + gap);
      ctx.lineTo(centerX + (offset - 0.5) * farCell + gap, far + gap);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.strokeStyle = accent(LINE_ALPHA);
  ctx.lineWidth = devicePixelRatio;
  ctx.beginPath();
  ctx.moveTo(0, height * HORIZON_RATIO);
  ctx.lineTo(width, height * HORIZON_RATIO);
  ctx.stroke();
}
