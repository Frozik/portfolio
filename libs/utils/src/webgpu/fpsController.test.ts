import { FpsController } from './fpsController';

const FALLBACK_FPS = 1;
const HIGH_FPS = 60;

describe('FpsController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns fallback FPS when no levels are active', () => {
    const controller = new FpsController(FALLBACK_FPS);
    expect(controller.getCurrentFps()).toBe(FALLBACK_FPS);
  });

  it('returns custom fallback FPS', () => {
    const customFallback = 10;
    const controller = new FpsController(customFallback);
    expect(controller.getCurrentFps()).toBe(customFallback);
  });

  it('returns raised FPS level after raise()', () => {
    const controller = new FpsController(FALLBACK_FPS);
    controller.raise(HIGH_FPS);
    expect(controller.getCurrentFps()).toBe(HIGH_FPS);
  });

  it('returns the maximum FPS across multiple raised levels', () => {
    const controller = new FpsController(FALLBACK_FPS);
    controller.raise(HIGH_FPS);
    controller.raise(HIGH_FPS);
    expect(controller.getCurrentFps()).toBe(HIGH_FPS);
  });

  it('removes level after debounce timeout', () => {
    const debounceMs = 500;
    const controller = new FpsController(FALLBACK_FPS);
    controller.raise(HIGH_FPS);
    expect(controller.getCurrentFps()).toBe(HIGH_FPS);

    vi.advanceTimersByTime(debounceMs);
    controller.tick();
    expect(controller.getCurrentFps()).toBe(FALLBACK_FPS);
  });

  it('resets debounce timer on repeated raise()', () => {
    const debounceMs = 500;
    const partialAdvance = 300;
    const controller = new FpsController(FALLBACK_FPS);

    controller.raise(HIGH_FPS);
    vi.advanceTimersByTime(partialAdvance);
    controller.tick();
    expect(controller.getCurrentFps()).toBe(HIGH_FPS);

    // Re-raise resets the timer
    controller.raise(HIGH_FPS);
    vi.advanceTimersByTime(partialAdvance);
    controller.tick();
    expect(controller.getCurrentFps()).toBe(HIGH_FPS);

    // Full debounce from last raise
    vi.advanceTimersByTime(debounceMs - partialAdvance);
    controller.tick();
    expect(controller.getCurrentFps()).toBe(FALLBACK_FPS);
  });

  it('computes correct frame interval', () => {
    const msPerSecond = 1000;
    const controller = new FpsController(FALLBACK_FPS);
    expect(controller.getFrameIntervalMs()).toBe(msPerSecond / FALLBACK_FPS);

    controller.raise(HIGH_FPS);
    expect(controller.getFrameIntervalMs()).toBe(msPerSecond / HIGH_FPS);
  });

  it('falls back to lower level when higher level expires', () => {
    const debounceMs = 500;
    const controller = new FpsController(FALLBACK_FPS);
    controller.raise(HIGH_FPS);
    controller.raise(HIGH_FPS);

    // Advance so both expire (same debounce for both)
    vi.advanceTimersByTime(debounceMs);
    controller.tick();
    expect(controller.getCurrentFps()).toBe(FALLBACK_FPS);
  });

  it('clears all timers and levels on dispose()', () => {
    const controller = new FpsController(FALLBACK_FPS);
    controller.raise(HIGH_FPS);
    controller.raise(HIGH_FPS);
    expect(controller.getCurrentFps()).toBe(HIGH_FPS);

    controller.dispose();
    expect(controller.getCurrentFps()).toBe(FALLBACK_FPS);
  });
});
