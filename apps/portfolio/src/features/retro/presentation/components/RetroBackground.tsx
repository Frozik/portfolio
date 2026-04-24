import { assert } from '@frozik/utils/assert/assert';
import { memo, useEffect, useRef } from 'react';

/**
 * Port of `apps/retro/bg.js` — a "team-of-minds" ambient animation: a small
 * constellation of nodes drifts gently, emits fading "thought" bubbles and
 * exchanges faint pulses along connecting lines. Runs on a 2D canvas,
 * respects `prefers-reduced-motion`, and clamps DPR to avoid high-resolution
 * displays tanking the GPU on an otherwise-decorative layer.
 */

const DEFAULT_OPACITY = 0.5;
const MAX_DPR = 2;

const NODE_COUNT = 7;
const NODE_POSITION_MIN = 0.15;
const NODE_POSITION_SPREAD = 0.7;
const NODE_FREQ_MIN = 0.12;
const NODE_FREQ_SPREAD = 0.08;
const NODE_EMIT_INITIAL_MAX_SEC = 3;
const NODE_EMIT_MIN_SEC = 1.5;
const NODE_EMIT_SPREAD_SEC = 2.5;
const NODE_DRIFT_X = 0.02;
const NODE_DRIFT_Y = 0.015;
const NODE_FREQ_Y_RATIO = 0.9;
const NODE_SPAWN_JITTER_X = 0.015;
const NODE_SPAWN_JITTER_Y = 0.012;
const NODE_HALO_RADIUS_PX = 24;
const NODE_DOT_RADIUS_PX = 2.2;
const NODE_HALO_ALPHA_INNER = 0.18;
const NODE_DOT_ALPHA = 0.5;

const CONNECTION_MAX_DISTANCE_RATIO = 0.32;
const CONNECTION_BASE_ALPHA = 0.06;
const PULSE_PERIOD_FREQ = 0.3;
const PULSE_PHASE_STEP_I = 0.2;
const PULSE_PHASE_STEP_J = 0.15;
const PULSE_RADIUS_PX = 1.5;
const PULSE_ALPHA_SCALE = 0.3;

const THOUGHT_MAX_COUNT = 120;
const THOUGHT_SPEED_MIN = 0.08;
const THOUGHT_SPEED_SPREAD = 0.14;
const THOUGHT_VY_BIAS = 0.8;
const THOUGHT_TTL_MIN_SEC = 4;
const THOUGHT_TTL_SPREAD_SEC = 4;
const THOUGHT_SIZE_MIN = 1.5;
const THOUGHT_SIZE_SPREAD = 1.8;
const THOUGHT_DRIFT_SCALE = 0.05;
const THOUGHT_ALPHA_PEAK = 0.35;
const THOUGHT_ALPHA_DAMP = 0.5;
const THOUGHT_SIZE_BASE_FACTOR = 0.5;
const THOUGHT_SIZE_FADE_FACTOR = 0.6;

const DELTA_TIME_CLAMP_SEC = 0.05;
const MS_PER_SECOND = 1000;
const TAU = Math.PI * 2;

const DEFAULT_ACCENT_RGB: readonly [number, number, number] = [96, 165, 250];
const THOUGHT_ACCENT_RGB: readonly [number, number, number] = [167, 139, 250];
const HEX_COLOR_PATTERN = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const HEX_RADIX = 16;

interface INode {
  readonly x: number;
  readonly y: number;
  readonly phase: number;
  readonly freq: number;
  emitT: number;
}

interface IThought {
  x: number;
  y: number;
  readonly vx: number;
  readonly vy: number;
  life: number;
  readonly ttl: number;
  readonly size: number;
}

type RetroBackgroundProps = {
  readonly opacity?: number;
};

function parseAccent(raw: string): readonly [number, number, number] {
  const match = raw.trim().match(HEX_COLOR_PATTERN);
  if (match === null) {
    return DEFAULT_ACCENT_RGB;
  }
  return [
    Number.parseInt(match[1], HEX_RADIX),
    Number.parseInt(match[2], HEX_RADIX),
    Number.parseInt(match[3], HEX_RADIX),
  ];
}

function readAccentRgb(): readonly [number, number, number] {
  if (typeof window === 'undefined') {
    return DEFAULT_ACCENT_RGB;
  }
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--color-landing-accent');
  return parseAccent(raw);
}

function createNodes(): INode[] {
  return Array.from({ length: NODE_COUNT }, () => ({
    x: NODE_POSITION_MIN + Math.random() * NODE_POSITION_SPREAD,
    y: NODE_POSITION_MIN + Math.random() * NODE_POSITION_SPREAD,
    phase: Math.random() * TAU,
    freq: NODE_FREQ_MIN + Math.random() * NODE_FREQ_SPREAD,
    emitT: Math.random() * NODE_EMIT_INITIAL_MAX_SEC,
  }));
}

function spawnThought(thoughts: IThought[], originX: number, originY: number): void {
  const angle = Math.random() * TAU;
  const speed = THOUGHT_SPEED_MIN + Math.random() * THOUGHT_SPEED_SPREAD;
  thoughts.push({
    x: originX,
    y: originY,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed * THOUGHT_VY_BIAS,
    life: 0,
    ttl: THOUGHT_TTL_MIN_SEC + Math.random() * THOUGHT_TTL_SPREAD_SEC,
    size: THOUGHT_SIZE_MIN + Math.random() * THOUGHT_SIZE_SPREAD,
  });
  if (thoughts.length > THOUGHT_MAX_COUNT) {
    thoughts.shift();
  }
}

const RetroBackgroundComponent = ({ opacity = DEFAULT_OPACITY }: RetroBackgroundProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    assert(canvas !== null, 'RetroBackground: canvas ref must be attached before effect runs');

    const context = canvas.getContext('2d');
    assert(context !== null, 'RetroBackground: 2D context is unavailable');

    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const nodes = createNodes();
    const thoughts: IThought[] = [];

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let frameId = 0;
    let cssWidth = 0;
    let cssHeight = 0;
    let lastTimestampMs = performance.now();

    const resize = () => {
      cssWidth = window.innerWidth;
      cssHeight = window.innerHeight;
      canvas.width = cssWidth * dpr;
      canvas.height = cssHeight * dpr;
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
    };

    const drawFrame = (timestampMs: DOMHighResTimeStamp) => {
      const deltaSeconds = Math.min(
        DELTA_TIME_CLAMP_SEC,
        (timestampMs - lastTimestampMs) / MS_PER_SECOND
      );
      lastTimestampMs = timestampMs;
      const nowSeconds = timestampMs / MS_PER_SECOND;

      const [accentR, accentG, accentB] = readAccentRgb();
      const [thoughtR, thoughtG, thoughtB] = THOUGHT_ACCENT_RGB;
      const { width, height } = canvas;

      context.clearRect(0, 0, width, height);

      // Update nodes (gentle Lissajous drift) and emit new thoughts.
      for (const node of nodes) {
        node.emitT -= deltaSeconds;
        if (node.emitT <= 0) {
          node.emitT = NODE_EMIT_MIN_SEC + Math.random() * NODE_EMIT_SPREAD_SEC;
          const jitterX = Math.sin(nowSeconds * node.freq + node.phase) * NODE_SPAWN_JITTER_X;
          const jitterY =
            Math.cos(nowSeconds * node.freq * NODE_FREQ_Y_RATIO + node.phase) * NODE_SPAWN_JITTER_Y;
          spawnThought(thoughts, node.x + jitterX, node.y + jitterY);
        }
      }

      // Draw connections between nearby nodes (very faint).
      const scale = Math.min(cssWidth, cssHeight);
      context.lineWidth = dpr;
      for (let indexA = 0; indexA < nodes.length; indexA++) {
        for (let indexB = indexA + 1; indexB < nodes.length; indexB++) {
          const nodeA = nodes[indexA];
          const nodeB = nodes[indexB];
          const ax =
            (nodeA.x + Math.sin(nowSeconds * nodeA.freq + nodeA.phase) * NODE_DRIFT_X) *
            cssWidth *
            dpr;
          const ay =
            (nodeA.y +
              Math.cos(nowSeconds * nodeA.freq * NODE_FREQ_Y_RATIO + nodeA.phase) * NODE_DRIFT_Y) *
            cssHeight *
            dpr;
          const bx =
            (nodeB.x + Math.sin(nowSeconds * nodeB.freq + nodeB.phase) * NODE_DRIFT_X) *
            cssWidth *
            dpr;
          const by =
            (nodeB.y +
              Math.cos(nowSeconds * nodeB.freq * NODE_FREQ_Y_RATIO + nodeB.phase) * NODE_DRIFT_Y) *
            cssHeight *
            dpr;
          const deltaX = bx - ax;
          const deltaY = by - ay;
          const distance = Math.hypot(deltaX, deltaY);
          const maxDistance = scale * dpr * CONNECTION_MAX_DISTANCE_RATIO;
          if (distance >= maxDistance) {
            continue;
          }

          const proximity = 1 - distance / maxDistance;
          const lineAlpha = proximity * CONNECTION_BASE_ALPHA;
          context.strokeStyle = `rgba(${accentR},${accentG},${accentB},${lineAlpha})`;
          context.beginPath();
          context.moveTo(ax, ay);
          context.lineTo(bx, by);
          context.stroke();

          // Pulse packet traveling between occasionally.
          const pulse =
            (nowSeconds * PULSE_PERIOD_FREQ +
              indexA * PULSE_PHASE_STEP_I +
              indexB * PULSE_PHASE_STEP_J) %
            1;
          const pulseX = ax + deltaX * pulse;
          const pulseY = ay + deltaY * pulse;
          context.fillStyle = `rgba(${accentR},${accentG},${accentB},${proximity * PULSE_ALPHA_SCALE})`;
          context.beginPath();
          context.arc(pulseX, pulseY, PULSE_RADIUS_PX * dpr, 0, TAU);
          context.fill();
        }
      }

      // Draw nodes (halo + dot).
      for (const node of nodes) {
        const x =
          (node.x + Math.sin(nowSeconds * node.freq + node.phase) * NODE_DRIFT_X) * cssWidth * dpr;
        const y =
          (node.y +
            Math.cos(nowSeconds * node.freq * NODE_FREQ_Y_RATIO + node.phase) * NODE_DRIFT_Y) *
          cssHeight *
          dpr;
        const haloRadius = NODE_HALO_RADIUS_PX * dpr;
        const haloGradient = context.createRadialGradient(x, y, 0, x, y, haloRadius);
        haloGradient.addColorStop(
          0,
          `rgba(${accentR},${accentG},${accentB},${NODE_HALO_ALPHA_INNER})`
        );
        haloGradient.addColorStop(1, `rgba(${accentR},${accentG},${accentB},0)`);
        context.fillStyle = haloGradient;
        context.fillRect(x - haloRadius, y - haloRadius, haloRadius * 2, haloRadius * 2);

        context.fillStyle = `rgba(${accentR},${accentG},${accentB},${NODE_DOT_ALPHA})`;
        context.beginPath();
        context.arc(x, y, NODE_DOT_RADIUS_PX * dpr, 0, TAU);
        context.fill();
      }

      // Update and draw thoughts.
      for (let index = thoughts.length - 1; index >= 0; index--) {
        const thought = thoughts[index];
        thought.life += deltaSeconds;
        if (thought.life > thought.ttl) {
          thoughts.splice(index, 1);
          continue;
        }
        thought.x += thought.vx * deltaSeconds * THOUGHT_DRIFT_SCALE;
        thought.y += thought.vy * deltaSeconds * THOUGHT_DRIFT_SCALE;
        const progress = thought.life / thought.ttl;
        const fade = Math.sin(progress * Math.PI); // rise and fall
        const alpha = fade * THOUGHT_ALPHA_PEAK;
        const x = thought.x * cssWidth * dpr;
        const y = thought.y * cssHeight * dpr;
        context.fillStyle = `rgba(${thoughtR},${thoughtG},${thoughtB},${alpha * THOUGHT_ALPHA_DAMP})`;
        context.beginPath();
        context.arc(
          x,
          y,
          thought.size * dpr * (THOUGHT_SIZE_BASE_FACTOR + fade * THOUGHT_SIZE_FADE_FACTOR),
          0,
          TAU
        );
        context.fill();
      }
    };

    const loop = (timestampMs: DOMHighResTimeStamp) => {
      drawFrame(timestampMs);
      frameId = requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener('resize', resize);

    if (prefersReducedMotion) {
      lastTimestampMs = performance.now();
      drawFrame(performance.now());
    } else {
      lastTimestampMs = performance.now();
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
      className="pointer-events-none fixed inset-0 z-0 h-dvh w-dvw print:hidden"
      // Opacity is a prop-driven numeric value; inline style is the
      // idiomatic way to apply it without generating infinite Tailwind
      // opacity arbitrary classes.
      style={{ opacity }}
    />
  );
};

export const RetroBackground = memo(RetroBackgroundComponent);

export type { RetroBackgroundProps };
