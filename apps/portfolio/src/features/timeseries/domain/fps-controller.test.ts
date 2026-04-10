import { EFpsLevel, FpsController } from './fps-controller';

describe('FpsController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns fallback FPS when no levels are active', () => {
    const controller = new FpsController();
    expect(controller.getCurrentFps()).toBe(EFpsLevel.Idle);
  });

  it('returns custom fallback FPS', () => {
    const customFallback = 10;
    const controller = new FpsController(customFallback);
    expect(controller.getCurrentFps()).toBe(customFallback);
  });

  it('returns raised FPS level after raise()', () => {
    const controller = new FpsController();
    controller.raise(EFpsLevel.Interaction);
    expect(controller.getCurrentFps()).toBe(EFpsLevel.Interaction);
  });

  it('returns the maximum FPS across multiple raised levels', () => {
    const controller = new FpsController();
    controller.raise(EFpsLevel.Resize);
    controller.raise(EFpsLevel.Interaction);
    expect(controller.getCurrentFps()).toBe(EFpsLevel.Interaction);
  });

  it('removes level after debounce timeout', () => {
    const debounceMs = 500;
    const controller = new FpsController();
    controller.raise(EFpsLevel.Resize);
    expect(controller.getCurrentFps()).toBe(EFpsLevel.Resize);

    vi.advanceTimersByTime(debounceMs);
    expect(controller.getCurrentFps()).toBe(EFpsLevel.Idle);
  });

  it('resets debounce timer on repeated raise()', () => {
    const debounceMs = 500;
    const partialAdvance = 300;
    const controller = new FpsController();

    controller.raise(EFpsLevel.Interaction);
    vi.advanceTimersByTime(partialAdvance);
    expect(controller.getCurrentFps()).toBe(EFpsLevel.Interaction);

    // Re-raise resets the timer
    controller.raise(EFpsLevel.Interaction);
    vi.advanceTimersByTime(partialAdvance);
    expect(controller.getCurrentFps()).toBe(EFpsLevel.Interaction);

    // Full debounce from last raise
    vi.advanceTimersByTime(debounceMs - partialAdvance);
    expect(controller.getCurrentFps()).toBe(EFpsLevel.Idle);
  });

  it('computes correct frame interval', () => {
    const msPerSecond = 1000;
    const controller = new FpsController();
    expect(controller.getFrameIntervalMs()).toBe(msPerSecond / EFpsLevel.Idle);

    controller.raise(EFpsLevel.Interaction);
    expect(controller.getFrameIntervalMs()).toBe(msPerSecond / EFpsLevel.Interaction);
  });

  it('falls back to lower level when higher level expires', () => {
    const debounceMs = 500;
    const controller = new FpsController();
    controller.raise(EFpsLevel.Resize);
    controller.raise(EFpsLevel.Interaction);

    // Advance so both expire (same debounce for both)
    vi.advanceTimersByTime(debounceMs);
    expect(controller.getCurrentFps()).toBe(EFpsLevel.Idle);
  });

  it('clears all timers and levels on dispose()', () => {
    const controller = new FpsController();
    controller.raise(EFpsLevel.Interaction);
    controller.raise(EFpsLevel.Resize);
    expect(controller.getCurrentFps()).toBe(EFpsLevel.Interaction);

    controller.dispose();
    expect(controller.getCurrentFps()).toBe(EFpsLevel.Idle);
  });
});
