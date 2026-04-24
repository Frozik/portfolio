import { assert } from '@frozik/utils';
import { memo, useEffect, useRef } from 'react';

/**
 * Ambient canvas for the conf lobby — a soft constellation of "call nodes"
 * connected by faint lines. Each node emits two outward ripples, like
 * voice pulses leaving a mouthpiece. Reads as "communication / connection"
 * rather than retro's drifting particles, without crowding the eye:
 * ≤18 nodes on desktop, halved on low-core devices, paused on hidden tabs
 * and reduced to a single static frame when `prefers-reduced-motion` is set.
 */

const DEFAULT_OPACITY = 0.55;
const DPR_MAX = 2;

const NODE_MIN_AREA_DIVISOR = 90_000;
const MAX_NODES_CAP = 18;
const LOW_CORE_THRESHOLD = 2;
const LOW_CORE_NODE_FACTOR = 0.5;

const NODE_POSITION_MIN = 0.1;
const NODE_POSITION_SPREAD = 0.8;
const NODE_DRIFT_X = 0.015;
const NODE_DRIFT_Y = 0.012;
const NODE_FREQ_MIN = 0.08;
const NODE_FREQ_SPREAD = 0.05;
const NODE_FREQ_Y_RATIO = 0.9;

const NODE_DOT_RADIUS_PX = 2.2;
const NODE_DOT_ALPHA = 0.55;
const NODE_HALO_RADIUS_PX = 14;
const NODE_HALO_ALPHA = 0.12;

const CONNECTION_RADIUS_PX = 220;
const LINE_BASE_ALPHA = 0.08;
const LINE_WIDTH_PX = 1;

const RIPPLE_COUNT_PER_NODE = 2;
const RIPPLE_PERIOD_MS = 2400;
const RIPPLE_STAGGER_MS = 1200;
const RIPPLE_MAX_RADIUS_PX = 42;
const RIPPLE_LINE_WIDTH_PX = 1;
const RIPPLE_ALPHA_PEAK = 0.3;

const MS_PER_SECOND = 1000;
const FADE_IN_DURATION_SEC = 0.4;
const VAR_PURPLE = '--color-landing-purple';
const VAR_YELLOW = '--color-landing-yellow';

interface INode {
  baseX: number;
  baseY: number;
  freqX: number;
  freqY: number;
  phaseX: number;
  phaseY: number;
  ripplePhaseMs: number;
}

function createNodes(count: number, nowMs: number): INode[] {
  const nodes: INode[] = [];
  for (let index = 0; index < count; index += 1) {
    nodes.push({
      baseX: NODE_POSITION_MIN + Math.random() * NODE_POSITION_SPREAD,
      baseY: NODE_POSITION_MIN + Math.random() * NODE_POSITION_SPREAD,
      freqX: NODE_FREQ_MIN + Math.random() * NODE_FREQ_SPREAD,
      freqY: (NODE_FREQ_MIN + Math.random() * NODE_FREQ_SPREAD) * NODE_FREQ_Y_RATIO,
      phaseX: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
      ripplePhaseMs: nowMs - Math.random() * RIPPLE_PERIOD_MS,
    });
  }
  return nodes;
}

function resolveNodeCount(width: number, height: number): number {
  const area = width * height;
  const base = Math.max(1, Math.floor(area / NODE_MIN_AREA_DIVISOR));
  const clamped = Math.min(MAX_NODES_CAP, base);
  const isLowCore =
    typeof navigator !== 'undefined' &&
    typeof navigator.hardwareConcurrency === 'number' &&
    navigator.hardwareConcurrency <= LOW_CORE_THRESHOLD;
  if (isLowCore) {
    return Math.max(1, Math.floor(clamped * LOW_CORE_NODE_FACTOR));
  }
  return clamped;
}

function readCssColor(variable: string, fallback: string): string {
  const root = document.documentElement;
  const value = getComputedStyle(root).getPropertyValue(variable).trim();
  return value.length > 0 ? value : fallback;
}

interface IDrawParams {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly INode[];
  readonly nowMs: number;
  readonly elapsedSec: number;
  readonly colorPrimary: string;
  readonly colorAccent: string;
}

function computeNodePosition(
  node: INode,
  width: number,
  height: number,
  elapsedSec: number
): { x: number; y: number } {
  const driftX = Math.sin(elapsedSec * node.freqX + node.phaseX) * NODE_DRIFT_X;
  const driftY = Math.cos(elapsedSec * node.freqY + node.phaseY) * NODE_DRIFT_Y;
  return {
    x: (node.baseX + driftX) * width,
    y: (node.baseY + driftY) * height,
  };
}

function drawConnections(
  params: IDrawParams,
  positions: readonly { x: number; y: number }[]
): void {
  const { ctx, colorPrimary } = params;
  ctx.lineWidth = LINE_WIDTH_PX;
  for (let outer = 0; outer < positions.length; outer += 1) {
    for (let inner = outer + 1; inner < positions.length; inner += 1) {
      const outerPoint = positions[outer];
      const innerPoint = positions[inner];
      assert(
        outerPoint !== undefined && innerPoint !== undefined,
        'positions array must stay in sync with nodes'
      );
      const dx = outerPoint.x - innerPoint.x;
      const dy = outerPoint.y - innerPoint.y;
      const distance = Math.hypot(dx, dy);
      if (distance >= CONNECTION_RADIUS_PX) {
        continue;
      }
      const alpha = LINE_BASE_ALPHA * (1 - distance / CONNECTION_RADIUS_PX);
      ctx.strokeStyle = colorPrimary;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(outerPoint.x, outerPoint.y);
      ctx.lineTo(innerPoint.x, innerPoint.y);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function drawNodes(params: IDrawParams, positions: readonly { x: number; y: number }[]): void {
  const { ctx, colorPrimary } = params;
  positions.forEach(point => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, NODE_HALO_RADIUS_PX, 0, Math.PI * 2);
    ctx.fillStyle = colorPrimary;
    ctx.globalAlpha = NODE_HALO_ALPHA;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(point.x, point.y, NODE_DOT_RADIUS_PX, 0, Math.PI * 2);
    ctx.globalAlpha = NODE_DOT_ALPHA;
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawRipples(params: IDrawParams, positions: readonly { x: number; y: number }[]): void {
  const { ctx, nowMs, colorAccent, nodes } = params;
  ctx.lineWidth = RIPPLE_LINE_WIDTH_PX;
  ctx.strokeStyle = colorAccent;
  nodes.forEach((node, index) => {
    const point = positions[index];
    assert(point !== undefined, 'ripple position must exist for node');
    for (let ringIndex = 0; ringIndex < RIPPLE_COUNT_PER_NODE; ringIndex += 1) {
      const ringPhaseMs =
        (nowMs - node.ripplePhaseMs + ringIndex * RIPPLE_STAGGER_MS) % RIPPLE_PERIOD_MS;
      const progress = ringPhaseMs / RIPPLE_PERIOD_MS;
      const radius = progress * RIPPLE_MAX_RADIUS_PX;
      const alpha = RIPPLE_ALPHA_PEAK * (1 - progress);
      if (alpha <= 0 || radius <= 0) {
        continue;
      }
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  ctx.globalAlpha = 1;
}

function drawFrame(params: IDrawParams): void {
  const { ctx, width, height, nodes, elapsedSec } = params;
  ctx.clearRect(0, 0, width, height);
  const positions = nodes.map(node => computeNodePosition(node, width, height, elapsedSec));
  drawConnections(params, positions);
  drawRipples(params, positions);
  drawNodes(params, positions);
}

export const ConfBackground = memo(() => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    assert(canvas !== null, 'canvas must be mounted before effect runs');
    const ctx = canvas.getContext('2d');
    assert(ctx !== null, '2D context must be available');

    const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const colorPrimary = readCssColor(VAR_PURPLE, '#a78bfa');
    const colorAccent = readCssColor(VAR_YELLOW, '#f5c842');
    let width = canvas.clientWidth;
    let height = canvas.clientHeight;
    const startMs = performance.now();
    let nodes: INode[] = createNodes(resolveNodeCount(width, height), startMs);

    const applySize = (): void => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      nodes = createNodes(resolveNodeCount(width, height), performance.now());
    };

    applySize();

    let rafHandle = 0;
    let running = true;

    const render = (timestamp: number): void => {
      const nowMs = timestamp;
      const elapsedSec = (nowMs - startMs) / MS_PER_SECOND;
      drawFrame({
        ctx,
        width,
        height,
        nodes,
        nowMs,
        elapsedSec,
        colorPrimary,
        colorAccent,
      });
      const fadeIn = Math.min(1, elapsedSec / FADE_IN_DURATION_SEC);
      canvas.style.opacity = `${fadeIn * DEFAULT_OPACITY}`;
      if (running) {
        rafHandle = requestAnimationFrame(render);
      }
    };

    if (reduceMotion) {
      const nowMs = performance.now();
      drawFrame({
        ctx,
        width,
        height,
        nodes,
        nowMs,
        elapsedSec: 0,
        colorPrimary,
        colorAccent,
      });
      canvas.style.opacity = String(DEFAULT_OPACITY);
    } else {
      rafHandle = requestAnimationFrame(render);
    }

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
