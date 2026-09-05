import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';

const DEFAULT_MAX_DPR = 2;
/**
 * Clamp the per-frame delta so a tab that was backgrounded (or a slow frame)
 * doesn't make time-stepped simulations jump on the next frame.
 */
const MAX_FRAME_DELTA_MS = 64;
const MS_PER_SECOND = 1000;
/** Lets a 30 fps target land on every second vsync of a 60 Hz display instead of every third. */
const FRAME_INTERVAL_TOLERANCE_MS = 1;

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
  /**
   * Upper bound for the backing-store density (default `2`). Soft content —
   * gradients, glows, small decorative sprites — looks the same at `1` and
   * costs a quarter of the fill.
   */
  readonly maxDpr?: number;
  /** Cap on draws per second; animation frames in between are skipped. Default: every frame. */
  readonly targetFps?: number;
  /**
   * Leave the backing store unallocated until the canvas first enters the
   * viewport (default `false`; implies `pauseWhenOffscreen`). For a grid of
   * below-the-fold canvases this avoids allocating and painting all of them
   * on load.
   */
  readonly allocateWhenVisible?: boolean;
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
 * canvas: 2D context acquisition, DPR-aware backing-store sizing driven by a
 * `ResizeObserver`, a `requestAnimationFrame` loop (paused while the page is
 * hidden or the canvas is offscreen, optionally capped to `targetFps`),
 * `prefers-reduced-motion` handling (one static frame, repainted on resize),
 * and full teardown on unmount. Callers provide only their per-frame `draw`
 * and an optional `onResize`.
 *
 * The size is never read from the element directly: the `ResizeObserver`
 * delivers it (it always reports once after `observe()`), so no forced layout
 * is triggered right after React's commit. Nothing is drawn before that first
 * report.
 *
 * All options are read through a ref, so passing fresh closures each render
 * does not re-initialise the loop.
 */
export function useAmbientCanvas(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  options: IUseAmbientCanvasOptions
): void {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const pauseWhenHidden = options.pauseWhenHidden ?? true;
  const allocateWhenVisible = options.allocateWhenVisible ?? false;
  const pauseWhenOffscreen = (options.pauseWhenOffscreen ?? true) || allocateWhenVisible;

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

    let observedCssWidth: number | null = null;
    let observedCssHeight: number | null = null;
    let allocated = false;
    let cssWidth = 0;
    let cssHeight = 0;
    let dpr = 1;
    let frameId: number | null = null;
    let startMs = 0;
    let lastMs = 0;
    let timingStarted = false;
    let pageVisible = !document.hidden;
    let onScreen = !allocateWhenVisible;

    const applySize = (): boolean => {
      if (observedCssWidth === null || observedCssHeight === null) {
        return false;
      }
      if (allocateWhenVisible && !onScreen) {
        return false;
      }
      const maxDpr = optionsRef.current.maxDpr ?? DEFAULT_MAX_DPR;
      const nextDpr = Math.min(maxDpr, window.devicePixelRatio || 1);
      const nextWidth = Math.round(observedCssWidth * nextDpr);
      const nextHeight = Math.round(observedCssHeight * nextDpr);
      const backingChanged = nextWidth !== canvas.width || nextHeight !== canvas.height;
      if (allocated && !backingChanged) {
        return false;
      }
      allocated = true;
      dpr = nextDpr;
      cssWidth = observedCssWidth;
      cssHeight = observedCssHeight;
      // Assigning canvas.width/height clears the backing store even when the
      // value is unchanged, so it is only written when it actually differs.
      if (backingChanged) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }
      optionsRef.current.onResize?.({ ctx, cssWidth, cssHeight, dpr });
      return true;
    };

    const renderStatic = (): void => {
      optionsRef.current.draw({
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
      optionsRef.current.draw({
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

    // The backing store was just (re)allocated, which cleared it. Repaint
    // synchronously — ResizeObserver callbacks run before paint, so the canvas
    // is never shown blank; the animated path repaints at the current time
    // rather than jumping back to the t=0 frame.
    const repaint = (): void => {
      if (prefersReducedMotion) {
        renderStatic();
      } else {
        renderFrame(performance.now());
      }
    };

    const isFrameDue = (timestamp: DOMHighResTimeStamp): boolean => {
      const targetFps = optionsRef.current.targetFps;
      if (targetFps === undefined || !timingStarted) {
        return true;
      }
      return timestamp - lastMs >= MS_PER_SECOND / targetFps - FRAME_INTERVAL_TOLERANCE_MS;
    };

    const loop = (timestamp: DOMHighResTimeStamp): void => {
      if (isFrameDue(timestamp)) {
        renderFrame(timestamp);
      }
      frameId = requestAnimationFrame(loop);
    };

    const shouldRun = (): boolean =>
      allocated && (!pauseWhenHidden || pageVisible) && (!pauseWhenOffscreen || onScreen);

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

    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[entries.length - 1];
      if (entry === undefined) {
        return;
      }
      observedCssWidth = entry.contentRect.width;
      observedCssHeight = entry.contentRect.height;
      if (applySize()) {
        repaint();
      }
      syncRunning();
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
        if (onScreen && applySize()) {
          repaint();
        }
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
      if (applySize()) {
        repaint();
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
  }, [canvasRef, pauseWhenHidden, pauseWhenOffscreen, allocateWhenVisible]);
}
