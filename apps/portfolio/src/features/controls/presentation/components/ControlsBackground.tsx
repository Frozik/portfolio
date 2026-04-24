import { assert } from '@frozik/utils/assert/assert';
import { memo, useEffect, useRef } from 'react';

/**
 * Ambient canvas for the Controls lobby — simulates lines of code being typed
 * in monospace columns, with a blinking caret at the currently-active line.
 * Each line types to a random character budget at a steady speed, then fades
 * out before respawning at a new vertical position. Mirrors the ConfBackground
 * rAF/DPR/visibility lifecycle; paints a single static frame when
 * `prefers-reduced-motion` is set.
 */

const DPR_MAX = 2;
const DEFAULT_OPACITY = 0.55;
const MS_PER_SECOND = 1000;
const FADE_IN_DURATION_SEC = 0.4;

const LINE_COUNT_DESKTOP = 6;
const LINE_COUNT_MOBILE = 3;
const MOBILE_WIDTH_THRESHOLD_PX = 720;

const CHARS_PER_SECOND = 18;
const LINE_MIN_CHARS = 22;
const LINE_MAX_CHARS = 56;
const LINE_GAP_MIN_MS = 400;
const LINE_GAP_MAX_MS = 1800;
const LINE_Y_MIN_RATIO = 0.08;
const LINE_Y_SPREAD_RATIO = 0.84;

const CARET_BLINK_PERIOD_MS = 1000;
const CARET_BLINK_HALF_MS = CARET_BLINK_PERIOD_MS / 2;
const CARET_WIDTH_PX = 6;
const CARET_HEIGHT_PX = 12;
const CARET_OFFSET_Y_PX = 10;
const CHAR_SPACING_PX = 8;
const LEFT_PADDING_PX = 24;
const TEXT_FONT = '12px ui-monospace, SFMono-Regular, Menlo, monospace';

const ALPHA_TYPED = 0.14;
const ALPHA_TAIL_FADE_DURATION_MS = 900;
const ALPHA_CARET = 0.55;

const RNG_SEED_BITS = 2654435761;

const VAR_ACCENT = '--color-landing-accent';
const FALLBACK_COLOR = '#60a5fa';

const VOCABULARY = 'abcdefghijklmnopqrstuvwxyz0123456789 =>{}()[]<>.,;:/_-+*!?"\'';

const REDUCED_MOTION_TYPED_RATIO = 0.5;

interface ITypingLine {
  y: number;
  startMs: number;
  charBudget: number;
  seed: number;
  finishedAtMs: number | null;
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomGapMs(): number {
  return randomRange(LINE_GAP_MIN_MS, LINE_GAP_MAX_MS);
}

function randomCharBudget(): number {
  return Math.floor(randomRange(LINE_MIN_CHARS, LINE_MAX_CHARS + 1));
}

function randomSeed(): number {
  // Integer seed used to pick vocabulary characters deterministically per line.
  return Math.floor(Math.random() * 0xffffffff);
}

function randomLineY(height: number): number {
  return (LINE_Y_MIN_RATIO + Math.random() * LINE_Y_SPREAD_RATIO) * height;
}

function createLine(height: number, nowMs: number, stagger: boolean): ITypingLine {
  return {
    y: randomLineY(height),
    startMs: stagger ? nowMs + randomGapMs() : nowMs,
    charBudget: randomCharBudget(),
    seed: randomSeed(),
    finishedAtMs: null,
  };
}

function resolveLineCount(width: number): number {
  return width < MOBILE_WIDTH_THRESHOLD_PX ? LINE_COUNT_MOBILE : LINE_COUNT_DESKTOP;
}

function readCssColor(variable: string, fallback: string): string {
  const root = document.documentElement;
  const value = getComputedStyle(root).getPropertyValue(variable).trim();
  return value.length > 0 ? value : fallback;
}

function charAtIndex(seed: number, index: number): string {
  const hashed = (seed ^ (index * RNG_SEED_BITS)) >>> 0;
  return VOCABULARY.charAt(hashed % VOCABULARY.length);
}

function computeTypedChars(line: ITypingLine, nowMs: number): number {
  const elapsedMs = nowMs - line.startMs;
  if (elapsedMs <= 0) {
    return 0;
  }
  const capped = Math.floor((elapsedMs * CHARS_PER_SECOND) / MS_PER_SECOND);
  return Math.min(line.charBudget, capped);
}

function computeLineAlpha(line: ITypingLine, nowMs: number): number {
  if (line.finishedAtMs === null) {
    return ALPHA_TYPED;
  }
  const tailMs = nowMs - line.finishedAtMs;
  if (tailMs >= ALPHA_TAIL_FADE_DURATION_MS) {
    return 0;
  }
  return ALPHA_TYPED * (1 - tailMs / ALPHA_TAIL_FADE_DURATION_MS);
}

function respawnLine(line: ITypingLine, height: number, nowMs: number): void {
  line.y = randomLineY(height);
  line.startMs = nowMs + randomGapMs();
  line.charBudget = randomCharBudget();
  line.seed = randomSeed();
  line.finishedAtMs = null;
}

function drawLineChars(
  ctx: CanvasRenderingContext2D,
  line: ITypingLine,
  typedChars: number,
  alpha: number,
  color: string
): void {
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  for (let index = 0; index < typedChars; index += 1) {
    const glyph = charAtIndex(line.seed, index);
    ctx.fillText(glyph, LEFT_PADDING_PX + index * CHAR_SPACING_PX, line.y);
  }
}

function findCurrentLineIndex(lines: readonly ITypingLine[], nowMs: number): number {
  let bestIndex = -1;
  let bestStart = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    assert(line !== undefined, 'line index must be in range');
    if (line.finishedAtMs !== null || line.startMs > nowMs) {
      continue;
    }
    if (line.startMs > bestStart) {
      bestStart = line.startMs;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function drawCaret(
  ctx: CanvasRenderingContext2D,
  line: ITypingLine,
  typedChars: number,
  nowMs: number,
  color: string
): void {
  const blinkOn = nowMs % CARET_BLINK_PERIOD_MS < CARET_BLINK_HALF_MS;
  if (!blinkOn) {
    return;
  }
  const caretX = LEFT_PADDING_PX + typedChars * CHAR_SPACING_PX;
  ctx.fillStyle = color;
  ctx.globalAlpha = ALPHA_CARET;
  ctx.fillRect(caretX, line.y - CARET_OFFSET_Y_PX, CARET_WIDTH_PX, CARET_HEIGHT_PX);
}

interface IDrawParams {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly lines: ITypingLine[];
  readonly nowMs: number;
  readonly color: string;
  readonly drawCaretEnabled: boolean;
}

function drawFrame(params: IDrawParams): void {
  const { ctx, width, height, lines, nowMs, color, drawCaretEnabled } = params;
  ctx.clearRect(0, 0, width, height);
  ctx.font = TEXT_FONT;
  ctx.textBaseline = 'alphabetic';

  for (const line of lines) {
    if (nowMs < line.startMs) {
      continue;
    }
    const typedChars = computeTypedChars(line, nowMs);
    if (typedChars >= line.charBudget && line.finishedAtMs === null) {
      line.finishedAtMs = nowMs;
    }
    const alpha = computeLineAlpha(line, nowMs);
    if (alpha <= 0) {
      respawnLine(line, height, nowMs);
      continue;
    }
    drawLineChars(ctx, line, typedChars, alpha, color);
  }

  if (!drawCaretEnabled) {
    ctx.globalAlpha = 1;
    return;
  }

  const activeIndex = findCurrentLineIndex(lines, nowMs);
  if (activeIndex !== -1) {
    const activeLine = lines[activeIndex];
    assert(activeLine !== undefined, 'active line must exist when index is valid');
    const typedChars = computeTypedChars(activeLine, nowMs);
    drawCaret(ctx, activeLine, typedChars, nowMs, color);
  }

  ctx.globalAlpha = 1;
}

function createLines(width: number, height: number, nowMs: number): ITypingLine[] {
  const count = resolveLineCount(width);
  const lines: ITypingLine[] = [];
  for (let index = 0; index < count; index += 1) {
    lines.push(createLine(height, nowMs, index > 0));
  }
  return lines;
}

function paintReducedMotionFrame(params: {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly lines: ITypingLine[];
  readonly color: string;
}): void {
  const { ctx, width, height, lines, color } = params;
  ctx.clearRect(0, 0, width, height);
  ctx.font = TEXT_FONT;
  ctx.textBaseline = 'alphabetic';
  for (const line of lines) {
    const typedChars = Math.max(1, Math.floor(line.charBudget * REDUCED_MOTION_TYPED_RATIO));
    drawLineChars(ctx, line, typedChars, ALPHA_TYPED, color);
  }
  ctx.globalAlpha = 1;
}

export const ControlsBackground = memo(() => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    assert(canvas !== null, 'canvas must be mounted before effect runs');
    const ctx = canvas.getContext('2d');
    assert(ctx !== null, '2D context must be available');

    const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const color = readCssColor(VAR_ACCENT, FALLBACK_COLOR);
    let width = canvas.clientWidth;
    let height = canvas.clientHeight;
    const startMs = performance.now();
    let lines: ITypingLine[] = createLines(width, height, startMs);

    const applySize = (): void => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lines = createLines(width, height, performance.now());
    };

    applySize();

    let rafHandle = 0;
    let running = true;

    const render = (timestamp: number): void => {
      const nowMs = timestamp;
      drawFrame({ ctx, width, height, lines, nowMs, color, drawCaretEnabled: true });
      const elapsedSec = (nowMs - startMs) / MS_PER_SECOND;
      const fadeIn = Math.min(1, elapsedSec / FADE_IN_DURATION_SEC);
      canvas.style.opacity = `${fadeIn * DEFAULT_OPACITY}`;
      if (running) {
        rafHandle = requestAnimationFrame(render);
      }
    };

    if (reduceMotion) {
      paintReducedMotionFrame({ ctx, width, height, lines, color });
      canvas.style.opacity = String(DEFAULT_OPACITY);
    } else {
      rafHandle = requestAnimationFrame(render);
    }

    const handleResize = (): void => {
      applySize();
      if (reduceMotion) {
        paintReducedMotionFrame({ ctx, width, height, lines, color });
      }
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
      if (!reduceMotion && !running) {
        running = true;
        rafHandle = requestAnimationFrame(render);
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

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full opacity-0 transition-opacity"
    />
  );
});
