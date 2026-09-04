import {
  DEFAULT_ACCENT_RGB,
  DEFAULT_GREEN_RGB,
  DEFAULT_RED_RGB,
  HEX_COLOR_PATTERN,
  HEX_RADIX,
  MONO_FONT_STACK,
} from '../../canvasTheme';
import type { IOrderbookSimulation } from './hero-orderbook-simulation';
import { DEPTH_COLUMNS, DEPTH_LEVELS } from './hero-orderbook-simulation';

const TAPE_AGE_FADE_MS = 12000;
const TAPE_FLASH_MS = 200;
const COLUMN_ALPHA_EXPONENT = 1.4;
const DEPTH_VISIBILITY_THRESHOLD = 0.02;
const DEPTH_ALPHA_MULTIPLIER = 0.55;
const GRID_LINE_INTERVAL = 10;
const GRID_LINE_ALPHA = 0.04;
const CELL_OVERDRAW_PX = 0.6;
const TAPE_START_Y_PX = 40;
const TAPE_HEADER_OFFSET_PX = 14;
const TAPE_DIVIDER_OFFSET_PX = 8;
const TAPE_ROW_HEIGHT_PX = 18;
const TAPE_LABEL_Y_PX = 24;
const TAPE_ARROW_OFFSET_PX = 2;
const TAPE_PRICE_OFFSET_PX = 14;
const TAPE_SIZE_BAR_OFFSET_PX = 8;
const TAPE_SIZE_BAR_HEIGHT_PX = 10;
const TAPE_SIZE_BAR_WIDTH_RATIO = 0.35;
const TAPE_SIZE_BAR_ALPHA = 0.55;
const TAPE_SIZE_VALUE_ALPHA = 0.85;
const TAPE_SIZE_VALUE_OFFSET_PX = 2;
const TAPE_SIZE_MULTIPLIER = 2.5;
const TAPE_SIZE_DECIMALS = 3;
const TAPE_PRICE_DECIMALS = 2;
const TAPE_COLUMN_SPLIT = 0.55;
const TAPE_FLASH_ALPHA = 0.18;
const TAPE_FLASH_INSET_PX = 2;
const TAPE_MAIN_ALPHA = 0.9;
const TAPE_HEADER_ALPHA = 0.35;
const TAPE_DIVIDER_ALPHA = 0.08;
const TAG_ALPHA = 0.5;
const TAG_FONT_SIZE_PX = 9;
const TAPE_FONT_SIZE_PX = 10;
const TAG_BOTTOM_OFFSET_PX = 12;
const TAG_LEFT_OFFSET_PX = 10;

type Rgb = readonly [number, number, number];

export interface IOrderbookPalette {
  readonly accent: Rgb;
  readonly green: Rgb;
  readonly red: Rgb;
}

/** Backing-store pixel geometry of the book and the tape beside it. */
export interface IOrderbookLayout {
  readonly width: number;
  readonly height: number;
  readonly devicePixelRatio: number;
  readonly bookWidth: number;
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly tapeWidth: number;
  readonly tapePaddingPx: number;
  readonly tapeOriginX: number;
}

function parseHexColor(raw: string, fallback: Rgb): Rgb {
  const match = raw.trim().match(HEX_COLOR_PATTERN);
  if (!match) {
    return fallback;
  }
  return [
    Number.parseInt(match[1], HEX_RADIX),
    Number.parseInt(match[2], HEX_RADIX),
    Number.parseInt(match[3], HEX_RADIX),
  ];
}

function readTokenRgb(token: string, fallback: Rgb): Rgb {
  if (typeof window === 'undefined') {
    return fallback;
  }
  return parseHexColor(
    getComputedStyle(document.documentElement).getPropertyValue(token),
    fallback
  );
}

export function readOrderbookPalette(): IOrderbookPalette {
  return {
    accent: readTokenRgb('--color-landing-accent', DEFAULT_ACCENT_RGB),
    green: readTokenRgb('--color-landing-green', DEFAULT_GREEN_RGB),
    red: readTokenRgb('--color-landing-red', DEFAULT_RED_RGB),
  };
}

function rgba(color: Rgb, alpha: number): string {
  return `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
}

function white(alpha: number): string {
  return `rgba(255,255,255,${alpha})`;
}

function paintDepthHeatmap(
  ctx: CanvasRenderingContext2D,
  simulation: IOrderbookSimulation,
  layout: IOrderbookLayout,
  palette: IOrderbookPalette
): void {
  const scrollPx = -simulation.columnPhase * layout.cellWidth;
  simulation.columns.forEach((column, columnIndex) => {
    const x = columnIndex * layout.cellWidth + scrollPx;
    if (x + layout.cellWidth < 0 || x > layout.bookWidth) {
      return;
    }
    const ageAlpha = (columnIndex / DEPTH_COLUMNS) ** COLUMN_ALPHA_EXPONENT;
    column.forEach((cell, level) => {
      const y = level * layout.cellHeight;
      const side =
        cell.ask > DEPTH_VISIBILITY_THRESHOLD
          ? { color: palette.red, depth: cell.ask }
          : cell.bid > DEPTH_VISIBILITY_THRESHOLD
            ? { color: palette.green, depth: cell.bid }
            : undefined;
      if (side !== undefined) {
        ctx.fillStyle = rgba(side.color, side.depth * ageAlpha * DEPTH_ALPHA_MULTIPLIER);
        ctx.fillRect(x, y, layout.cellWidth + CELL_OVERDRAW_PX, layout.cellHeight);
      }
    });
  });
}

function paintBookGridLines(ctx: CanvasRenderingContext2D, layout: IOrderbookLayout): void {
  ctx.strokeStyle = white(GRID_LINE_ALPHA);
  ctx.lineWidth = layout.devicePixelRatio;
  for (let level = GRID_LINE_INTERVAL; level < DEPTH_LEVELS; level += GRID_LINE_INTERVAL) {
    const y = level * layout.cellHeight;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(layout.bookWidth, y);
    ctx.stroke();
  }
}

function paintBookLabel(
  ctx: CanvasRenderingContext2D,
  layout: IOrderbookLayout,
  palette: IOrderbookPalette
): void {
  const { devicePixelRatio } = layout;
  ctx.font = `${TAG_FONT_SIZE_PX * devicePixelRatio}px ${MONO_FONT_STACK}`;
  ctx.fillStyle = rgba(palette.accent, TAG_ALPHA);
  ctx.fillText(
    'BTC/USDT · DEPTH',
    TAG_LEFT_OFFSET_PX * devicePixelRatio,
    layout.height - TAG_BOTTOM_OFFSET_PX * devicePixelRatio
  );
}

function paintTapeHeader(ctx: CanvasRenderingContext2D, layout: IOrderbookLayout): void {
  const { devicePixelRatio, tapeOriginX, tapeWidth, tapePaddingPx } = layout;
  const tapeTop = TAPE_START_Y_PX * devicePixelRatio;
  const headerY = tapeTop - TAPE_HEADER_OFFSET_PX * devicePixelRatio;
  const dividerY = tapeTop - TAPE_DIVIDER_OFFSET_PX * devicePixelRatio;
  ctx.font = `${TAPE_FONT_SIZE_PX * devicePixelRatio}px ${MONO_FONT_STACK}`;
  ctx.fillStyle = white(TAPE_HEADER_ALPHA);
  ctx.fillText('PRICE', tapeOriginX, headerY);
  ctx.fillText('SIZE', tapeOriginX + tapeWidth * TAPE_COLUMN_SPLIT, headerY);

  ctx.strokeStyle = white(TAPE_DIVIDER_ALPHA);
  ctx.beginPath();
  ctx.moveTo(tapeOriginX - TAPE_DIVIDER_OFFSET_PX * devicePixelRatio, dividerY);
  ctx.lineTo(tapeOriginX + tapeWidth - tapePaddingPx, dividerY);
  ctx.stroke();
}

function paintTapeRows(
  ctx: CanvasRenderingContext2D,
  simulation: IOrderbookSimulation,
  layout: IOrderbookLayout,
  palette: IOrderbookPalette
): void {
  const { devicePixelRatio, tapeOriginX, tapeWidth, tapePaddingPx } = layout;
  const tapeTop = TAPE_START_Y_PX * devicePixelRatio;
  const rowHeight = TAPE_ROW_HEIGHT_PX * devicePixelRatio;
  const sizeBarX = tapeOriginX + tapeWidth * TAPE_COLUMN_SPLIT;
  const sizeBarMaxWidth = (tapeWidth - tapePaddingPx) * TAPE_SIZE_BAR_WIDTH_RATIO;

  simulation.tape.forEach((entry, index) => {
    const rowsFromBottom = simulation.tape.length - 1 - index;
    const y = tapeTop + rowsFromBottom * rowHeight;
    const fade = Math.min(1, 1 - entry.ageMs / TAPE_AGE_FADE_MS);
    const flash = entry.ageMs < TAPE_FLASH_MS ? 1 - entry.ageMs / TAPE_FLASH_MS : 0;
    const color = entry.side === 'buy' ? palette.green : palette.red;

    if (flash > 0) {
      ctx.fillStyle = rgba(color, flash * TAPE_FLASH_ALPHA);
      ctx.fillRect(
        tapeOriginX - TAPE_DIVIDER_OFFSET_PX * devicePixelRatio,
        y - rowHeight + (TAPE_SIZE_BAR_OFFSET_PX / 2) * devicePixelRatio,
        tapeWidth - (TAPE_HEADER_OFFSET_PX - TAPE_FLASH_INSET_PX) * devicePixelRatio,
        rowHeight
      );
    }

    ctx.fillStyle = rgba(color, TAPE_MAIN_ALPHA * fade);
    ctx.fillText(
      entry.side === 'buy' ? '▲' : '▼',
      tapeOriginX - TAPE_ARROW_OFFSET_PX * devicePixelRatio,
      y
    );
    ctx.fillText(
      entry.price.toFixed(TAPE_PRICE_DECIMALS),
      tapeOriginX + TAPE_PRICE_OFFSET_PX * devicePixelRatio,
      y
    );

    ctx.fillStyle = rgba(color, TAPE_SIZE_BAR_ALPHA * fade);
    ctx.fillRect(
      sizeBarX,
      y - TAPE_SIZE_BAR_OFFSET_PX * devicePixelRatio,
      sizeBarMaxWidth * entry.size,
      TAPE_SIZE_BAR_HEIGHT_PX * devicePixelRatio
    );

    ctx.fillStyle = white(TAPE_SIZE_VALUE_ALPHA * fade);
    ctx.fillText(
      (entry.size * TAPE_SIZE_MULTIPLIER).toFixed(TAPE_SIZE_DECIMALS),
      sizeBarX + TAPE_SIZE_VALUE_OFFSET_PX * devicePixelRatio,
      y
    );
  });
}

function paintTapeLabel(
  ctx: CanvasRenderingContext2D,
  layout: IOrderbookLayout,
  palette: IOrderbookPalette
): void {
  ctx.fillStyle = rgba(palette.accent, TAG_ALPHA);
  ctx.font = `${TAG_FONT_SIZE_PX * layout.devicePixelRatio}px ${MONO_FONT_STACK}`;
  ctx.fillText('TRADES · LIVE', layout.tapeOriginX, TAPE_LABEL_Y_PX * layout.devicePixelRatio);
}

export function paintOrderbook(
  ctx: CanvasRenderingContext2D,
  simulation: IOrderbookSimulation,
  layout: IOrderbookLayout,
  palette: IOrderbookPalette
): void {
  ctx.clearRect(0, 0, layout.width, layout.height);
  paintDepthHeatmap(ctx, simulation, layout, palette);
  paintBookGridLines(ctx, layout);
  paintBookLabel(ctx, layout, palette);
  paintTapeHeader(ctx, layout);
  paintTapeRows(ctx, simulation, layout, palette);
  paintTapeLabel(ctx, layout, palette);
}
