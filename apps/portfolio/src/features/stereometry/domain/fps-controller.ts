import { MS_PER_SECOND } from './constants';

export enum EFpsLevel {
  Idle = 1,
  Resize = 60,
  Interaction = 60,
  Animation = 60,
}

/** Debounce duration before an FPS level is automatically removed. */
const FPS_DEBOUNCE_MS = 500;

export class FpsController {
  private readonly activeLevels = new Map<EFpsLevel, ReturnType<typeof setTimeout>>();
  private readonly fallbackFps: number;

  constructor(fallbackFps: number = EFpsLevel.Idle) {
    this.fallbackFps = fallbackFps;
  }

  raise(level: EFpsLevel): void {
    const existingTimer = this.activeLevels.get(level);
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.activeLevels.delete(level);
    }, FPS_DEBOUNCE_MS);
    this.activeLevels.set(level, timer);
  }

  getFrameIntervalMs(): number {
    return MS_PER_SECOND / this.getCurrentFps();
  }

  getCurrentFps(): number {
    if (this.activeLevels.size === 0) {
      return this.fallbackFps;
    }

    let maxFps = 0;
    for (const level of this.activeLevels.keys()) {
      if (level > maxFps) {
        maxFps = level;
      }
    }
    return maxFps;
  }

  dispose(): void {
    for (const timer of this.activeLevels.values()) {
      clearTimeout(timer);
    }
    this.activeLevels.clear();
  }
}
