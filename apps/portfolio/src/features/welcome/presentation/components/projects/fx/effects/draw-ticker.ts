import { DARK_SURFACE_HEX, darkSurface, MONO_FONT_STACK } from '../../../../canvasTheme';
import type { IFxDrawContext } from '../types';
import { pseudoRandom } from '../utils';

const AXIS_WIDTH_PX = 48;
const ROWS = 28;
const MIN_COLUMN_WIDTH_PX = 4;
const COLUMN_WIDTH_DIVISOR = 60;
const EXTRA_COLUMNS = 2;
const MID_WAVE_SPEED = 0.18;
const MID_WAVE_ROWS = 4;
const MID_RIPPLE_SPEED = 0.07;
const MID_RIPPLE_PHASE = 1.2;
const MID_RIPPLE_ROWS = 2.5;
const COLUMN_TIME_LAG = 0.15;
const COLUMN_TIME_SCALE = 0.5;
const SCROLL_SPEED = 0.8;
const SURFACE_ALPHA = 0.4;
const DEPTH_SPREAD_ROWS = 4.2;
const DEPTH_BASE_ALPHA = 0.6;
const NOISE_SEED_SCALE = 0.3;
const NOISE_ALPHA = 0.5;
const NOISE_REACH_ROWS = 12;
const WALL_SEED_PERIOD = 35;
const WALL_SEED_WRAP = 999;
const WALL_SEED_ROW_SCALE = 0.11;
const WALL_THRESHOLD = 0.82;
const WALL_ALPHA = 0.55;
const WALL_REACH_ROWS = 10;
const CELL_VISIBILITY_THRESHOLD = 0.03;
const CELL_OVERDRAW_PX = 0.5;
const BID_ALPHA = 0.9;
const ASK_ALPHA = 0.45;
const MID_LINE_ALPHA = 0.9;
const MID_LINE_WIDTH_PX = 1.4;
const MID_LINE_DASH_PX = [4, 3] as const;
const MID_LINE_SAMPLES = 40;
const LABEL_FONT_PX = 9;
const AXIS_LABEL_ALPHA = 0.35;
const AXIS_FIRST_ROW = 2;
const AXIS_ROW_STEP = 4;
const AXIS_LABEL_OFFSET_X_PX = 4;
const AXIS_LABEL_OFFSET_Y_PX = 3;
const BASE_PRICE = 67892.5;
const PRICE_STEP = 2.5;
const AXIS_PRICE_DECIMALS = 1;
const MID_PRICE_DECIMALS = 2;
const PRICE_TAG_PADDING_PX = 10;
const PRICE_TAG_INSET_PX = 2;
const PRICE_TAG_HALF_HEIGHT_PX = 8;
const PRICE_TAG_HEIGHT_PX = 16;
const PRICE_TAG_TEXT_X_PX = 7;
const PRICE_TAG_TEXT_Y_PX = 3.5;
const TITLE_ALPHA = 0.6;
const TITLE_X_PX = 8;
const TITLE_Y_PX = 14;
const BLINK_HZ = 3;
const LIVE_DOT_ALPHA = 0.95;
const LIVE_DOT_X_PX = 10;
const LIVE_DOT_Y_PX = 10;
const LIVE_DOT_RADIUS_PX = 2.5;
const LIVE_LABEL_ALPHA = 0.65;
const LIVE_LABEL_X_PX = 18;
const LIVE_LABEL_Y_PX = 7;

/** A scrolling orderbook heatmap with a mid-price line and a live price tag on the axis. */
export function drawTicker({
  ctx,
  width,
  height,
  time,
  accent,
  devicePixelRatio,
}: IFxDrawContext): void {
  const axisWidth = AXIS_WIDTH_PX * devicePixelRatio;
  const gridWidth = width - axisWidth;
  const cellHeight = height / ROWS;
  const columnWidth = Math.max(
    MIN_COLUMN_WIDTH_PX * devicePixelRatio,
    gridWidth / COLUMN_WIDTH_DIVISOR
  );
  const columns = Math.ceil(gridWidth / columnWidth) + EXTRA_COLUMNS;

  const midRowAt = (seconds: number): number =>
    ROWS / 2 +
    Math.sin(seconds * MID_WAVE_SPEED) * MID_WAVE_ROWS +
    Math.sin(seconds * MID_RIPPLE_SPEED + MID_RIPPLE_PHASE) * MID_RIPPLE_ROWS;
  const midRowNow = midRowAt(time);
  const midRowOfColumn = (column: number): number =>
    midRowAt(time - column * (columnWidth / (gridWidth * COLUMN_TIME_SCALE + 1)) * COLUMN_TIME_LAG);

  const scrollPosition = time * SCROLL_SPEED;
  const offsetX = -(scrollPosition % 1) * columnWidth;
  const firstColumnIndex = Math.floor(scrollPosition);

  ctx.fillStyle = darkSurface(SURFACE_ALPHA);
  ctx.fillRect(0, 0, gridWidth, height);

  for (let columnIndex = 0; columnIndex < columns; columnIndex++) {
    const columnAbsolute = firstColumnIndex + columnIndex;
    const x = offsetX + columnIndex * columnWidth;
    const midRow = midRowOfColumn(columnIndex);
    for (let rowIndex = 0; rowIndex < ROWS; rowIndex++) {
      const distance = Math.abs(rowIndex - midRow);
      const noise = pseudoRandom(columnAbsolute * NOISE_SEED_SCALE, rowIndex);
      const wallSeed = rowIndex + Math.floor((columnAbsolute / WALL_SEED_PERIOD) % WALL_SEED_WRAP);
      const hasWall = pseudoRandom(wallSeed, rowIndex * WALL_SEED_ROW_SCALE) > WALL_THRESHOLD;
      const depth =
        Math.exp(-((distance / DEPTH_SPREAD_ROWS) ** 2)) * DEPTH_BASE_ALPHA +
        noise * noise * NOISE_ALPHA * Math.max(0, 1 - distance / NOISE_REACH_ROWS) +
        (hasWall ? WALL_ALPHA * Math.max(0, 1 - distance / WALL_REACH_ROWS) : 0);
      if (depth < CELL_VISIBILITY_THRESHOLD) {
        continue;
      }
      const intensity = Math.min(1, depth);
      ctx.fillStyle =
        rowIndex > midRow ? accent(intensity * BID_ALPHA) : accent(intensity * ASK_ALPHA);
      ctx.fillRect(
        x,
        rowIndex * cellHeight,
        columnWidth + CELL_OVERDRAW_PX,
        cellHeight + CELL_OVERDRAW_PX
      );
    }
  }

  const rowCenterY = (row: number): number => row * cellHeight + cellHeight / 2;
  ctx.strokeStyle = accent(MID_LINE_ALPHA);
  ctx.lineWidth = MID_LINE_WIDTH_PX * devicePixelRatio;
  ctx.setLineDash(MID_LINE_DASH_PX.map(dash => dash * devicePixelRatio));
  ctx.beginPath();
  ctx.moveTo(0, rowCenterY(midRowOfColumn(columns - 1)));
  for (let sampleIndex = 1; sampleIndex <= MID_LINE_SAMPLES; sampleIndex++) {
    const progress = sampleIndex / MID_LINE_SAMPLES;
    ctx.lineTo(progress * gridWidth, rowCenterY(midRowOfColumn((columns - 1) * (1 - progress))));
  }
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = `${LABEL_FONT_PX * devicePixelRatio}px ${MONO_FONT_STACK}`;
  ctx.fillStyle = accent(AXIS_LABEL_ALPHA);
  ctx.textAlign = 'left';
  for (let rowIndex = AXIS_FIRST_ROW; rowIndex < ROWS; rowIndex += AXIS_ROW_STEP) {
    const price = BASE_PRICE + (ROWS / 2 - rowIndex) * PRICE_STEP;
    ctx.fillText(
      price.toFixed(AXIS_PRICE_DECIMALS),
      gridWidth + AXIS_LABEL_OFFSET_X_PX * devicePixelRatio,
      rowCenterY(rowIndex) + AXIS_LABEL_OFFSET_Y_PX * devicePixelRatio
    );
  }

  const midLineY = rowCenterY(midRowNow);
  const midPrice = (BASE_PRICE + (ROWS / 2 - midRowNow) * PRICE_STEP).toFixed(MID_PRICE_DECIMALS);
  const tagWidth = ctx.measureText(midPrice).width + PRICE_TAG_PADDING_PX * devicePixelRatio;
  ctx.fillStyle = accent(1);
  ctx.fillRect(
    gridWidth + PRICE_TAG_INSET_PX * devicePixelRatio,
    midLineY - PRICE_TAG_HALF_HEIGHT_PX * devicePixelRatio,
    tagWidth,
    PRICE_TAG_HEIGHT_PX * devicePixelRatio
  );
  ctx.fillStyle = DARK_SURFACE_HEX;
  ctx.fillText(
    midPrice,
    gridWidth + PRICE_TAG_TEXT_X_PX * devicePixelRatio,
    midLineY + PRICE_TAG_TEXT_Y_PX * devicePixelRatio
  );

  ctx.fillStyle = accent(TITLE_ALPHA);
  ctx.fillText('BTC/USDT · DEPTH', TITLE_X_PX * devicePixelRatio, TITLE_Y_PX * devicePixelRatio);
  if (Math.floor(time * BLINK_HZ) % 2 === 0) {
    ctx.fillStyle = accent(LIVE_DOT_ALPHA);
    ctx.beginPath();
    ctx.arc(
      LIVE_DOT_X_PX * devicePixelRatio,
      height - LIVE_DOT_Y_PX * devicePixelRatio,
      LIVE_DOT_RADIUS_PX * devicePixelRatio,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.fillStyle = accent(LIVE_LABEL_ALPHA);
  ctx.fillText(
    'LIVE · WSS',
    LIVE_LABEL_X_PX * devicePixelRatio,
    height - LIVE_LABEL_Y_PX * devicePixelRatio
  );
}
