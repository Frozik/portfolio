import { assert } from '@frozik/utils';
import { memo, useEffect, useRef } from 'react';

const MAX_DPR = 2;
const PRICE_BASE = 77600;
const PRICE_RANGE = 80;
const LEVELS = 48;
const COLS = 180;
const COL_MS = 220;
const FRAME_CLAMP_MS = 64;
const TAPE_MAX_ROWS = 20;
const TAPE_AGE_FADE_MS = 12000;
const TAPE_FLASH_MS = 200;
const PRICE_STEP_MIN_DT = 0.6;
const PRICE_REVERSION = 0.0008;
const PRICE_DECAY_BASE = 0.92;
const PRICE_CLAMP_RATIO = 0.6;
const COLUMN_ALPHA_EXP = 1.4;
const DEPTH_DECAY_RATIO = 0.25;
const DEPTH_BASE_MIN = 0.4;
const DEPTH_BASE_RANDOM = 0.6;
const DEPTH_WALL_PROB = 0.04;
const DEPTH_WALL_MIN = 0.6;
const DEPTH_WALL_RANDOM = 0.4;
const DEPTH_VISIBILITY_THRESHOLD = 0.02;
const DEPTH_ALPHA_MULT = 0.55;
const GRID_LINE_INTERVAL = 10;
const GRID_LINE_ALPHA = 0.04;
const CELL_OVERDRAW_PX = 0.6;
const TAPE_WIDTH_MAX_PX = 260;
const TAPE_WIDTH_RATIO = 0.22;
const TAPE_PADDING_PX = 20;
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
const TAPE_SIZE_MULT = 2.5;
const TAPE_COLUMN_SPLIT = 0.55;
const TAPE_ADD_PROB = 0.6;
const TAPE_BUY_PROB = 0.5;
const TAPE_FLASH_ALPHA = 0.18;
const TAPE_MAIN_ALPHA = 0.9;
const TAPE_PRICE_JITTER = 4;
const TAG_FONT_SIZE_PX = 9;
const TAPE_FONT_SIZE_PX = 10;
const MONO_FONT_STACK = 'ui-monospace, Menlo, Monaco, Consolas, monospace';
const TAG_BOTTOM_OFFSET_PX = 12;
const TAG_LEFT_OFFSET_PX = 10;
const DEFAULT_ACCENT_RGB: readonly [number, number, number] = [96, 165, 250];
const DEFAULT_GREEN_RGB: readonly [number, number, number] = [76, 217, 100];
const DEFAULT_RED_RGB: readonly [number, number, number] = [255, 79, 88];
const HEX_COLOR_PATTERN = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const HEX_RADIX = 16;

type Rgb = readonly [number, number, number];

interface IDepthCell {
  bid: number;
  ask: number;
}

interface ITapeEntry {
  price: number;
  side: 'buy' | 'sell';
  size: number;
  age: number;
}

interface ISimulationState {
  grid: IDepthCell[][];
  tape: ITapeEntry[];
  midPrice: number;
  velocity: number;
  colPhase: number;
  lastTimestamp: DOMHighResTimeStamp;
}

interface IPalette {
  readonly accent: Rgb;
  readonly green: Rgb;
  readonly red: Rgb;
}

interface IFrameLayout {
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
  readonly bookWidth: number;
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly tapeWidth: number;
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
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token);
  return parseHexColor(raw, fallback);
}

function readPalette(): IPalette {
  return {
    accent: readTokenRgb('--color-landing-accent', DEFAULT_ACCENT_RGB),
    green: readTokenRgb('--color-landing-green', DEFAULT_GREEN_RGB),
    red: readTokenRgb('--color-landing-red', DEFAULT_RED_RGB),
  };
}

function rgba(color: Rgb, alpha: number): string {
  return `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
}

function createEmptyGrid(): IDepthCell[][] {
  return Array.from({ length: COLS }, () =>
    Array.from({ length: LEVELS }, () => ({ bid: 0, ask: 0 }))
  );
}

function createDepthColumn(midPrice: number): IDepthCell[] {
  const midLevel = LEVELS / 2 + ((PRICE_BASE - midPrice) / PRICE_RANGE) * LEVELS;
  const column: IDepthCell[] = [];
  for (let index = 0; index < LEVELS; index++) {
    const distance = Math.abs(index - midLevel);
    const isAsk = index < midLevel;
    const decay = Math.exp(-distance / (LEVELS * DEPTH_DECAY_RATIO));
    const base = decay * (DEPTH_BASE_MIN + Math.random() * DEPTH_BASE_RANDOM);
    const wall =
      Math.random() < DEPTH_WALL_PROB ? DEPTH_WALL_MIN + Math.random() * DEPTH_WALL_RANDOM : 0;
    const value = Math.min(1, base + wall);
    column.push(isAsk ? { bid: 0, ask: value } : { bid: value, ask: 0 });
  }
  return column;
}

function stepMarket(state: ISimulationState, deltaMs: number): void {
  state.velocity += (Math.random() - 0.5) * PRICE_STEP_MIN_DT * deltaMs;
  state.velocity += (PRICE_BASE - state.midPrice) * PRICE_REVERSION * deltaMs;
  state.velocity *= PRICE_DECAY_BASE ** deltaMs;
  state.midPrice += state.velocity * deltaMs;
  const clampBound = PRICE_RANGE * PRICE_CLAMP_RATIO;
  if (state.midPrice > PRICE_BASE + clampBound) {
    state.midPrice = PRICE_BASE + clampBound;
  } else if (state.midPrice < PRICE_BASE - clampBound) {
    state.midPrice = PRICE_BASE - clampBound;
  }
}

function advanceColumn(state: ISimulationState): void {
  state.grid.shift();
  state.grid.push(createDepthColumn(state.midPrice));
  if (Math.random() < TAPE_ADD_PROB) {
    const side: 'buy' | 'sell' = Math.random() < TAPE_BUY_PROB ? 'buy' : 'sell';
    const jitter = (Math.random() - 0.5) * TAPE_PRICE_JITTER;
    state.tape.push({ price: state.midPrice + jitter, side, size: Math.random(), age: 0 });
  }
  while (state.tape.length > TAPE_MAX_ROWS) {
    state.tape.shift();
  }
}

function advanceSimulation(state: ISimulationState, deltaMs: number): void {
  stepMarket(state, deltaMs);
  state.colPhase += deltaMs / COL_MS;
  while (state.colPhase >= 1) {
    advanceColumn(state);
    state.colPhase -= 1;
  }
  for (const entry of state.tape) {
    entry.age += deltaMs;
  }
}

function createSimulationState(): ISimulationState {
  const state: ISimulationState = {
    grid: createEmptyGrid(),
    tape: [],
    midPrice: PRICE_BASE,
    velocity: 0,
    colPhase: 0,
    lastTimestamp: performance.now(),
  };
  // Prime history so the heatmap is filled on first paint.
  for (let index = 0; index < COLS; index++) {
    advanceColumn(state);
  }
  return state;
}

function computeLayout(canvas: HTMLCanvasElement, cssWidth: number, dpr: number): IFrameLayout {
  const { width, height } = canvas;
  const tapeWidth = Math.min(TAPE_WIDTH_MAX_PX, cssWidth * TAPE_WIDTH_RATIO) * dpr;
  const bookWidth = width - tapeWidth - TAPE_PADDING_PX * dpr;
  return {
    width,
    height,
    dpr,
    bookWidth,
    cellWidth: bookWidth / COLS,
    cellHeight: height / LEVELS,
    tapeWidth,
    tapeOriginX: width - tapeWidth + TAPE_HEADER_OFFSET_PX * dpr,
  };
}

function drawDepthHeatmap(
  ctx: CanvasRenderingContext2D,
  state: ISimulationState,
  layout: IFrameLayout,
  palette: IPalette
): void {
  const scrollPx = -state.colPhase * layout.cellWidth;
  for (let columnIndex = 0; columnIndex < COLS; columnIndex++) {
    const x = columnIndex * layout.cellWidth + scrollPx;
    if (x + layout.cellWidth < 0 || x > layout.bookWidth) {
      continue;
    }
    const column = state.grid[columnIndex];
    const ageAlpha = (columnIndex / COLS) ** COLUMN_ALPHA_EXP;
    for (let levelIndex = 0; levelIndex < LEVELS; levelIndex++) {
      const cell = column[levelIndex];
      const y = levelIndex * layout.cellHeight;
      if (cell.ask > DEPTH_VISIBILITY_THRESHOLD) {
        ctx.fillStyle = rgba(palette.red, cell.ask * ageAlpha * DEPTH_ALPHA_MULT);
        ctx.fillRect(x, y, layout.cellWidth + CELL_OVERDRAW_PX, layout.cellHeight);
      } else if (cell.bid > DEPTH_VISIBILITY_THRESHOLD) {
        ctx.fillStyle = rgba(palette.green, cell.bid * ageAlpha * DEPTH_ALPHA_MULT);
        ctx.fillRect(x, y, layout.cellWidth + CELL_OVERDRAW_PX, layout.cellHeight);
      }
    }
  }
}

function drawBookGridLines(ctx: CanvasRenderingContext2D, layout: IFrameLayout): void {
  ctx.strokeStyle = `rgba(255,255,255,${GRID_LINE_ALPHA})`;
  ctx.lineWidth = layout.dpr;
  for (let index = GRID_LINE_INTERVAL; index < LEVELS; index += GRID_LINE_INTERVAL) {
    const y = index * layout.cellHeight;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(layout.bookWidth, y);
    ctx.stroke();
  }
}

function drawBookLabel(
  ctx: CanvasRenderingContext2D,
  layout: IFrameLayout,
  palette: IPalette
): void {
  ctx.font = `${TAG_FONT_SIZE_PX * layout.dpr}px ${MONO_FONT_STACK}`;
  ctx.fillStyle = rgba(palette.accent, 0.5);
  ctx.fillText(
    'BTC/USDT · DEPTH',
    TAG_LEFT_OFFSET_PX * layout.dpr,
    layout.height - TAG_BOTTOM_OFFSET_PX * layout.dpr
  );
}

function drawTapeHeader(ctx: CanvasRenderingContext2D, layout: IFrameLayout): void {
  const tapeY0 = TAPE_START_Y_PX * layout.dpr;
  ctx.font = `${TAPE_FONT_SIZE_PX * layout.dpr}px ${MONO_FONT_STACK}`;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('PRICE', layout.tapeOriginX, tapeY0 - TAPE_HEADER_OFFSET_PX * layout.dpr);
  ctx.fillText(
    'SIZE',
    layout.tapeOriginX + layout.tapeWidth * TAPE_COLUMN_SPLIT,
    tapeY0 - TAPE_HEADER_OFFSET_PX * layout.dpr
  );

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(
    layout.tapeOriginX - TAPE_DIVIDER_OFFSET_PX * layout.dpr,
    tapeY0 - TAPE_DIVIDER_OFFSET_PX * layout.dpr
  );
  ctx.lineTo(
    layout.tapeOriginX + layout.tapeWidth - TAPE_PADDING_PX * layout.dpr,
    tapeY0 - TAPE_DIVIDER_OFFSET_PX * layout.dpr
  );
  ctx.stroke();
}

function drawTapeRows(
  ctx: CanvasRenderingContext2D,
  state: ISimulationState,
  layout: IFrameLayout,
  palette: IPalette
): void {
  const tapeY0 = TAPE_START_Y_PX * layout.dpr;
  const rowHeight = TAPE_ROW_HEIGHT_PX * layout.dpr;
  for (let index = 0; index < state.tape.length; index++) {
    const entry = state.tape[index];
    const idxFromBottom = state.tape.length - 1 - index;
    const y = tapeY0 + idxFromBottom * rowHeight;
    const fade = Math.min(1, 1 - entry.age / TAPE_AGE_FADE_MS);
    const flash = entry.age < TAPE_FLASH_MS ? 1 - entry.age / TAPE_FLASH_MS : 0;
    const isBuy = entry.side === 'buy';
    const color = isBuy ? palette.green : palette.red;

    if (flash > 0) {
      ctx.fillStyle = rgba(color, flash * TAPE_FLASH_ALPHA);
      ctx.fillRect(
        layout.tapeOriginX - TAPE_DIVIDER_OFFSET_PX * layout.dpr,
        y - rowHeight + (TAPE_SIZE_BAR_OFFSET_PX / 2) * layout.dpr,
        layout.tapeWidth - (TAPE_HEADER_OFFSET_PX - 2) * layout.dpr,
        rowHeight
      );
    }

    ctx.fillStyle = rgba(color, TAPE_MAIN_ALPHA * fade);
    ctx.fillText(isBuy ? '▲' : '▼', layout.tapeOriginX - TAPE_ARROW_OFFSET_PX * layout.dpr, y);
    ctx.fillText(entry.price.toFixed(2), layout.tapeOriginX + TAPE_PRICE_OFFSET_PX * layout.dpr, y);

    const sizeBarX = layout.tapeOriginX + layout.tapeWidth * TAPE_COLUMN_SPLIT;
    const sizeBarWidth =
      (layout.tapeWidth - TAPE_PADDING_PX * layout.dpr) * TAPE_SIZE_BAR_WIDTH_RATIO * entry.size;
    ctx.fillStyle = rgba(color, TAPE_SIZE_BAR_ALPHA * fade);
    ctx.fillRect(
      sizeBarX,
      y - TAPE_SIZE_BAR_OFFSET_PX * layout.dpr,
      sizeBarWidth,
      TAPE_SIZE_BAR_HEIGHT_PX * layout.dpr
    );

    ctx.fillStyle = `rgba(255,255,255,${TAPE_SIZE_VALUE_ALPHA * fade})`;
    ctx.fillText(
      (entry.size * TAPE_SIZE_MULT).toFixed(3),
      sizeBarX + TAPE_SIZE_VALUE_OFFSET_PX * layout.dpr,
      y
    );
  }
}

function drawTapeLabel(
  ctx: CanvasRenderingContext2D,
  layout: IFrameLayout,
  palette: IPalette
): void {
  ctx.fillStyle = rgba(palette.accent, 0.5);
  ctx.font = `${TAG_FONT_SIZE_PX * layout.dpr}px ${MONO_FONT_STACK}`;
  ctx.fillText('TRADES · LIVE', layout.tapeOriginX, TAPE_LABEL_Y_PX * layout.dpr);
}

function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: ISimulationState,
  layout: IFrameLayout,
  palette: IPalette
): void {
  ctx.clearRect(0, 0, layout.width, layout.height);
  drawDepthHeatmap(ctx, state, layout, palette);
  drawBookGridLines(ctx, layout);
  drawBookLabel(ctx, layout, palette);
  drawTapeHeader(ctx, layout);
  drawTapeRows(ctx, state, layout, palette);
  drawTapeLabel(ctx, layout, palette);
}

const HeroOrderbookComponent = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    assert(canvas !== null, 'HeroOrderbook: canvas ref must be attached before effect runs');
    const context = canvas.getContext('2d');
    assert(context !== null, 'HeroOrderbook: 2D context is unavailable');

    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    let cssWidth = 0;
    let frameId = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      cssWidth = rect.width;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };
    resize();

    const state = createSimulationState();

    const tick = (now: DOMHighResTimeStamp) => {
      const deltaMs = Math.min(FRAME_CLAMP_MS, now - state.lastTimestamp);
      state.lastTimestamp = now;
      advanceSimulation(state, deltaMs);
      renderFrame(context, state, computeLayout(canvas, cssWidth, dpr), readPalette());
    };

    const loop = (now: DOMHighResTimeStamp) => {
      tick(now);
      frameId = requestAnimationFrame(loop);
    };

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.addEventListener('resize', resize);
    if (prefersReducedMotion) {
      tick(performance.now());
    } else {
      frameId = requestAnimationFrame(loop);
    }

    return () => {
      window.removeEventListener('resize', resize);
      if (frameId !== 0) {
        cancelAnimationFrame(frameId);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-55 [mask-image:linear-gradient(180deg,transparent_0%,#000_25%,#000_75%,transparent_100%)]"
    />
  );
};

export const HeroOrderbook = memo(HeroOrderbookComponent);
