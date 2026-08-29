import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';

/** Device-pixel-ratio is clamped so a 3x phone doesn't quadruple the fill cost. */
const MAX_DPR = 2;
/**
 * Clamp the per-frame delta so a tab that was backgrounded (or a slow frame)
 * doesn't make time-stepped simulations jump on the next frame.
 */
const MAX_FRAME_DELTA_MS = 64;

export interface IAmbientCanvasFrame {
  readonly ctx: CanvasRenderingContext2D;
  /** CSS-pixel canvas size (backing store is `cssWidth * dpr`). */
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly dpr: number;
  /** Milliseconds since the loop started. `0` on the static reduced-motion frame. */
  readonly elapsedMs: number;
  /** Milliseconds since the previous frame, clamped to {@link MAX_FRAME_DELTA_MS}. `0` on the first/static frame. */
  readonly deltaMs: number;
  readonly timestamp: DOMHighResTimeStamp;
  /** `true` for the single `prefers-reduced-motion` frame (and resize repaints), `false` inside the rAF loop. */
  readonly isStatic: boolean;
}

export interface IAmbientCanvasResize {
  readonly ctx: CanvasRenderingContext2D;
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly dpr: number;
}

export interface IUseAmbientCanvasOptions {
  /**
   * Per-frame draw. Under `prefers-reduced-motion` it is called once (a single
   * static frame) and again after every resize, instead of in a rAF loop.
   */
  readonly draw: (frame: IAmbientCanvasFrame) => void;
  /**
   * Called after the canvas backing store is (re)sized, before the matching
   * draw — the place to regenerate size-dependent state or read theme colours
   * once (rather than per frame). Setting `canvas.width` resets the 2D context
   * state, so any persistent transform/state must be re-applied from here.
   */
  readonly onResize?: (size: IAmbientCanvasResize) => void;
  /** Pause the rAF loop while the page is hidden (default `true`). */
  readonly pauseWhenHidden?: boolean;
  /** Pause the rAF loop while the canvas is fully offscreen (default `true`). */
  readonly pauseWhenOffscreen?: boolean;
}

/**
 * The framework-free half of an ambient canvas: its per-frame `draw` plus the
 * `onResize` that (re)builds size-dependent state. Each feature's
 * `*-background-animation.ts` returns one of these so the React component only
 * has to create it and hand it to {@link useAmbientCanvas}.
 */
export interface IAmbientCanvasAnimation {
  readonly draw: (frame: IAmbientCanvasFrame) => void;
  readonly onResize: (size: IAmbientCanvasResize) => void;
}

/**
 * Owns the boilerplate canvas lifecycle shared by every ambient/background
 * canvas: 2D context acquisition, DPR-aware backing-store sizing via a
 * `ResizeObserver`, a `requestAnimationFrame` loop (paused while the page is
 * hidden or the canvas is offscreen), `prefers-reduced-motion` handling (one
 * static frame, repainted on resize), and full teardown on unmount. Callers
 * provide only their per-frame `draw` and an optional `onResize`.
 *
 * `draw`/`onResize` are read from refs, so passing fresh closures each render
 * does not re-initialise the loop.
 */
export function useAmbientCanvas(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  options: IUseAmbientCanvasOptions
): void {
  const drawRef = useRef(options.draw);
  drawRef.current = options.draw;
  const onResizeRef = useRef(options.onResize);
  onResizeRef.current = options.onResize;

  const pauseWhenHidden = options.pauseWhenHidden ?? true;
  const pauseWhenOffscreen = options.pauseWhenOffscreen ?? true;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return undefined;
    }
    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      return undefined;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let cssWidth = 0;
    let cssHeight = 0;
    let dpr = 1;
    let frameId: number | null = null;
    let startMs = 0;
    let lastMs = 0;
    let timingStarted = false;
    let pageVisible = !document.hidden;
    let onScreen = true;

    const applySize = (force: boolean): boolean => {
      const nextDpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      const nextCssWidth = canvas.clientWidth;
      const nextCssHeight = canvas.clientHeight;
      const nextWidth = Math.round(nextCssWidth * nextDpr);
      const nextHeight = Math.round(nextCssHeight * nextDpr);
      const backingChanged = nextWidth !== canvas.width || nextHeight !== canvas.height;
      // Assigning canvas.width/height clears the backing store even when the value
      // is unchanged, so skip no-op resizes — ResizeObserver fires spuriously and
      // each needless clear flickers the canvas blank for a frame. The initial call
      // must still run (`force`): on a re-run of this effect over an already-sized
      // canvas (React StrictMode remounts the same element) the early return would
      // leave dpr/cssWidth/cssHeight at their initial 1/0/0 and skip onResize,
      // and every subsequent frame would draw with wrong metrics until a real
      // resize happened to come through.
      if (!backingChanged && !force) {
        return false;
      }
      dpr = nextDpr;
      cssWidth = nextCssWidth;
      cssHeight = nextCssHeight;
      if (backingChanged) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }
      onResizeRef.current?.({ ctx, cssWidth, cssHeight, dpr });
      return backingChanged;
    };

    const renderStatic = (): void => {
      drawRef.current({
        ctx,
        cssWidth,
        cssHeight,
        dpr,
        elapsedMs: 0,
        deltaMs: 0,
        timestamp: performance.now(),
        isStatic: true,
      });
    };

    const renderFrame = (timestamp: DOMHighResTimeStamp): void => {
      if (!timingStarted) {
        startMs = timestamp;
        lastMs = timestamp;
        timingStarted = true;
      }
      const deltaMs = Math.min(MAX_FRAME_DELTA_MS, timestamp - lastMs);
      lastMs = timestamp;
      drawRef.current({
        ctx,
        cssWidth,
        cssHeight,
        dpr,
        elapsedMs: timestamp - startMs,
        deltaMs,
        timestamp,
        isStatic: false,
      });
    };

    const loop = (timestamp: DOMHighResTimeStamp): void => {
      renderFrame(timestamp);
      frameId = requestAnimationFrame(loop);
    };

    const shouldRun = (): boolean =>
      (!pauseWhenHidden || pageVisible) && (!pauseWhenOffscreen || onScreen);

    const start = (): void => {
      if (frameId === null && shouldRun()) {
        // Keep the elapsed baseline across a pause (so time-based animation stays
        // continuous); the per-frame `deltaMs` clamp absorbs the gap on resume.
        frameId = requestAnimationFrame(loop);
      }
    };

    const stop = (): void => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    };

    const syncRunning = (): void => {
      if (prefersReducedMotion) {
        return;
      }
      if (shouldRun()) {
        start();
      } else {
        stop();
      }
    };

    applySize(true);
    if (prefersReducedMotion) {
      renderStatic();
    } else {
      start();
    }

    const resizeObserver = new ResizeObserver(() => {
      if (!applySize(false)) {
        return;
      }
      // The width/height assignment just cleared the backing store. Repaint
      // synchronously here — ResizeObserver callbacks run before paint, so the
      // canvas is never shown blank. Otherwise the next rAF leaves one empty
      // frame, which reads as a flicker during continuous resize. The animated
      // path repaints at the current time (no jump back to the t=0 frame).
      if (prefersReducedMotion) {
        renderStatic();
      } else {
        renderFrame(performance.now());
      }
    });
    resizeObserver.observe(canvas);

    const handleVisibility = (): void => {
      pageVisible = !document.hidden;
      syncRunning();
    };
    if (pauseWhenHidden) {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    let intersectionObserver: IntersectionObserver | null = null;
    if (pauseWhenOffscreen) {
      intersectionObserver = new IntersectionObserver(entries => {
        onScreen = entries.some(entry => entry.isIntersecting);
        syncRunning();
      });
      intersectionObserver.observe(canvas);
    }

    // ResizeObserver only fires when the element's CSS size changes, so a
    // devicePixelRatio change alone (window dragged to another monitor, browser
    // zoom) would leave the backing store at the old density. Watch the current
    // dpr via a one-shot matchMedia listener, re-armed after every change.
    let dprMediaQuery: MediaQueryList | null = null;
    const watchDprChange = (): void => {
      dprMediaQuery?.removeEventListener('change', handleDprChange);
      dprMediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      dprMediaQuery.addEventListener('change', handleDprChange);
    };
    function handleDprChange(): void {
      if (applySize(false)) {
        // Same reasoning as the ResizeObserver path: the assignment cleared the
        // backing store, so repaint immediately instead of showing a blank frame.
        if (prefersReducedMotion) {
          renderStatic();
        } else {
          renderFrame(performance.now());
        }
      }
      watchDprChange();
    }
    watchDprChange();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver?.disconnect();
      dprMediaQuery?.removeEventListener('change', handleDprChange);
      if (pauseWhenHidden) {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [canvasRef, pauseWhenHidden, pauseWhenOffscreen]);
}
