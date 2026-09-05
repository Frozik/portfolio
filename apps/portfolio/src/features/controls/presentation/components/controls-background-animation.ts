import { assertNever } from '@frozik/utils/assert/assertNever';
import { random } from 'lodash-es';

import type {
  IAmbientCanvasAnimation,
  IAmbientCanvasFrame,
  IAmbientCanvasResize,
} from '../../../../shared/hooks/useAmbientCanvas';

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

const MAX_SEED = 0xffffffff;
const SEED_HASH_MULTIPLIER = 2654435761;

const VAR_ACCENT = '--color-landing-accent';
const FALLBACK_COLOR = '#60a5fa';

const VOCABULARY = 'abcdefghijklmnopqrstuvwxyz0123456789 =>{}()[]<>.,;:/_-+*!?"\'';

const REDUCED_MOTION_TYPED_RATIO = 0.5;

/** A line's placement and the seed its characters are derived from. */
interface ILineLayout {
  readonly y: number;
  readonly charBudget: number;
  readonly seed: number;
}

/** A line is typed from `startMs`, then fades from `finishedAtMs` and respawns. */
type TypingLine =
  | (ILineLayout & { readonly phase: 'typing'; readonly startMs: number })
  | (ILineLayout & {
      readonly phase: 'fading';
      readonly startMs: number;
      readonly finishedAtMs: number;
    });

function spawnLine(height: number, startMs: number): TypingLine {
  return {
    phase: 'typing',
    y: random(LINE_Y_MIN_RATIO, LINE_Y_MIN_RATIO + LINE_Y_SPREAD_RATIO, true) * height,
    startMs,
    charBudget: random(LINE_MIN_CHARS, LINE_MAX_CHARS),
    seed: random(0, MAX_SEED),
  };
}

function spawnLineAfterGap(height: number, nowMs: number): TypingLine {
  return spawnLine(height, nowMs + random(LINE_GAP_MIN_MS, LINE_GAP_MAX_MS, true));
}

function resolveLineCount(width: number): number {
  return width < MOBILE_WIDTH_THRESHOLD_PX ? LINE_COUNT_MOBILE : LINE_COUNT_DESKTOP;
}

function readCssColor(variable: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value.length > 0 ? value : fallback;
}

function charAtIndex(seed: number, index: number): string {
  const hashed = (seed ^ (index * SEED_HASH_MULTIPLIER)) >>> 0;
  return VOCABULARY.charAt(hashed % VOCABULARY.length);
}

function computeTypedChars(line: TypingLine, nowMs: number): number {
  const elapsedMs = nowMs - line.startMs;
  if (elapsedMs <= 0) {
    return 0;
  }
  return Math.min(line.charBudget, Math.floor((elapsedMs * CHARS_PER_SECOND) / MS_PER_SECOND));
}

function computeLineAlpha(line: TypingLine, nowMs: number): number {
  switch (line.phase) {
    case 'typing':
      return ALPHA_TYPED;
    case 'fading': {
      const tailMs = nowMs - line.finishedAtMs;
      return tailMs >= ALPHA_TAIL_FADE_DURATION_MS
        ? 0
        : ALPHA_TYPED * (1 - tailMs / ALPHA_TAIL_FADE_DURATION_MS);
    }
    default:
      return assertNever(line);
  }
}

/** One simulation step: a fully typed line starts fading, a faded-out line respawns. */
function advanceLine(line: TypingLine, nowMs: number, height: number): TypingLine {
  switch (line.phase) {
    case 'typing':
      return computeTypedChars(line, nowMs) >= line.charBudget
        ? { ...line, phase: 'fading', finishedAtMs: nowMs }
        : line;
    case 'fading':
      return computeLineAlpha(line, nowMs) <= 0 ? spawnLineAfterGap(height, nowMs) : line;
    default:
      return assertNever(line);
  }
}

function advanceLines(
  lines: readonly TypingLine[],
  nowMs: number,
  height: number
): readonly TypingLine[] {
  return lines.map(line => advanceLine(line, nowMs, height));
}

/** The line typed most recently that is still being typed; it carries the caret. */
function findCaretLine(lines: readonly TypingLine[], nowMs: number): TypingLine | undefined {
  let caretLine: TypingLine | undefined;
  for (const line of lines) {
    const isBeingTyped = line.phase === 'typing' && line.startMs <= nowMs;
    if (isBeingTyped && (caretLine === undefined || line.startMs > caretLine.startMs)) {
      caretLine = line;
    }
  }
  return caretLine;
}

function paintLineChars(
  ctx: CanvasRenderingContext2D,
  line: TypingLine,
  typedChars: number,
  alpha: number,
  color: string
): void {
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  for (let charIndex = 0; charIndex < typedChars; charIndex += 1) {
    ctx.fillText(
      charAtIndex(line.seed, charIndex),
      LEFT_PADDING_PX + charIndex * CHAR_SPACING_PX,
      line.y
    );
  }
}

function paintCaret(
  ctx: CanvasRenderingContext2D,
  line: TypingLine,
  typedChars: number,
  nowMs: number,
  color: string
): void {
  if (nowMs % CARET_BLINK_PERIOD_MS >= CARET_BLINK_HALF_MS) {
    return;
  }
  ctx.fillStyle = color;
  ctx.globalAlpha = ALPHA_CARET;
  const caretX = LEFT_PADDING_PX + typedChars * CHAR_SPACING_PX;
  ctx.fillRect(caretX, line.y - CARET_OFFSET_Y_PX, CARET_WIDTH_PX, CARET_HEIGHT_PX);
}

function beginPaint(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.clearRect(0, 0, width, height);
  ctx.font = TEXT_FONT;
  ctx.textBaseline = 'alphabetic';
}

function paintLines(params: {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly lines: readonly TypingLine[];
  readonly nowMs: number;
  readonly color: string;
}): void {
  const { ctx, width, height, lines, nowMs, color } = params;
  beginPaint(ctx, width, height);
  for (const line of lines) {
    if (nowMs < line.startMs) {
      continue;
    }
    const alpha = computeLineAlpha(line, nowMs);
    if (alpha > 0) {
      paintLineChars(ctx, line, computeTypedChars(line, nowMs), alpha, color);
    }
  }
  const caretLine = findCaretLine(lines, nowMs);
  if (caretLine !== undefined) {
    paintCaret(ctx, caretLine, computeTypedChars(caretLine, nowMs), nowMs, color);
  }
  ctx.globalAlpha = 1;
}

function paintReducedMotionFrame(params: {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly lines: readonly TypingLine[];
  readonly color: string;
}): void {
  const { ctx, width, height, lines, color } = params;
  beginPaint(ctx, width, height);
  for (const line of lines) {
    const typedChars = Math.max(1, Math.floor(line.charBudget * REDUCED_MOTION_TYPED_RATIO));
    paintLineChars(ctx, line, typedChars, ALPHA_TYPED, color);
  }
  ctx.globalAlpha = 1;
}

function createLines(width: number, height: number, nowMs: number): readonly TypingLine[] {
  return Array.from({ length: resolveLineCount(width) }, (_, index) =>
    index === 0 ? spawnLine(height, nowMs) : spawnLineAfterGap(height, nowMs)
  );
}

/** Lines of code typed in monospace with a blinking caret; a static frame under reduced motion. */
export function createControlsBackgroundAnimation(): IAmbientCanvasAnimation {
  let lines: readonly TypingLine[] = [];
  let color = FALLBACK_COLOR;

  return {
    onResize({ ctx, cssWidth, cssHeight, dpr }: IAmbientCanvasResize): void {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      color = readCssColor(VAR_ACCENT, FALLBACK_COLOR);
      lines = createLines(cssWidth, cssHeight, performance.now());
    },

    draw(frame: IAmbientCanvasFrame): void {
      const { ctx, cssWidth, cssHeight, timestamp, elapsedMs, isStatic } = frame;
      if (isStatic) {
        paintReducedMotionFrame({ ctx, width: cssWidth, height: cssHeight, lines, color });
        ctx.canvas.style.opacity = String(DEFAULT_OPACITY);
        return;
      }
      lines = advanceLines(lines, timestamp, cssHeight);
      paintLines({ ctx, width: cssWidth, height: cssHeight, lines, nowMs: timestamp, color });
      const fadeIn = Math.min(1, elapsedMs / MS_PER_SECOND / FADE_IN_DURATION_SEC);
      ctx.canvas.style.opacity = `${fadeIn * DEFAULT_OPACITY}`;
    },
  };
}
