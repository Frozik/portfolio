import { assert } from '@frozik/utils/assert/assert';
import { memo, useEffect, useRef } from 'react';

import { buildAccentFn, getFxDraw } from './fx/effects';
import type { TProjectFxKind } from './fx/types';
import { readAccentRgb } from './fx/utils';

const MAX_DPR = 2;
const HOVERED_SPEED = 1;
const IDLE_SPEED = 0.45;
const MS_PER_SECOND = 1000;

type ProjectFxProps = {
  readonly kind: TProjectFxKind;
  readonly hovered: boolean;
};

const ProjectFxComponent = ({ kind, hovered }: ProjectFxProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoveredRef = useRef(hovered);

  hoveredRef.current = hovered;

  useEffect(() => {
    const canvas = canvasRef.current;
    assert(canvas !== null, 'ProjectFx: canvas ref must be attached before effect runs');

    const context = canvas.getContext('2d');
    assert(context !== null, 'ProjectFx: 2D context is unavailable');

    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    let frameId = 0;
    let cssWidth = 0;
    let cssHeight = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return;
      }
      cssWidth = rect.width;
      cssHeight = rect.height;
      canvas.width = cssWidth * dpr;
      canvas.height = cssHeight * dpr;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const drawFn = getFxDraw(kind);
    const state: Record<string, unknown> = {};
    const start = performance.now();

    const loop = () => {
      if (canvas.width === 0 || canvas.height === 0) {
        frameId = requestAnimationFrame(loop);
        return;
      }
      const time = (performance.now() - start) / MS_PER_SECOND;
      const speed = hoveredRef.current ? HOVERED_SPEED : IDLE_SPEED;
      const accent = buildAccentFn(readAccentRgb());
      context.clearRect(0, 0, canvas.width, canvas.height);
      drawFn(
        {
          ctx: context,
          width: canvas.width,
          height: canvas.height,
          time,
          speed,
          accent,
          dpr,
        },
        state
      );
      frameId = requestAnimationFrame(loop);
    };

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      // Single static frame — still visually correct.
      loop();
      cancelAnimationFrame(frameId);
      frameId = 0;
    } else {
      frameId = requestAnimationFrame(loop);
    }

    return () => {
      observer.disconnect();
      if (frameId !== 0) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [kind]);

  return (
    <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-[1] h-full w-full" />
  );
};

export const ProjectFx = memo(ProjectFxComponent);
