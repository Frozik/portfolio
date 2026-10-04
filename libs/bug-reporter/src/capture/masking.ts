import type { ICaptureMask, TRestoreMask } from '../core/ports';
import { CAPTURE_ATTRIBUTE } from '../core/sensitive';

/**
 * Holds the masking attribute for as long as any capture is in flight, and
 * only hands control back once the masked frame has actually been painted.
 */
export class DomCaptureMask implements ICaptureMask {
  private holders = 0;

  constructor(private readonly root: HTMLElement = document.documentElement) {}

  async apply(): Promise<TRestoreMask> {
    this.holders += 1;
    this.root.setAttribute(CAPTURE_ATTRIBUTE, '');
    await paintedFrame();
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      this.holders -= 1;
      if (this.holders === 0) {
        this.root.removeAttribute(CAPTURE_ATTRIBUTE);
      }
    };
  }
}

/** Resolves after the next frame has been committed: one rAF schedules the style change, the second runs after it painted. */
function paintedFrame(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}
