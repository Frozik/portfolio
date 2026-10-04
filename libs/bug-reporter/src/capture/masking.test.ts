import { afterEach, describe, expect, it, vi } from 'vitest';

import { CAPTURE_ATTRIBUTE } from '../core/sensitive';
import { DomCaptureMask } from './masking';

describe('DomCaptureMask', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.removeAttribute(CAPTURE_ATTRIBUTE);
  });

  it('marks the document before the capture and settles only after two frames were painted', async () => {
    let frames = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      frames += 1;
      callback(frames);
      return frames;
    });
    const mask = new DomCaptureMask();

    const restore = await mask.apply();

    expect(frames).toBe(2);
    expect(document.documentElement.hasAttribute(CAPTURE_ATTRIBUTE)).toBe(true);
    restore();
    expect(document.documentElement.hasAttribute(CAPTURE_ATTRIBUTE)).toBe(false);
  });

  it('keeps the mask while any capture still holds it', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callback(0);
      return 0;
    });
    const mask = new DomCaptureMask();
    const releaseRecording = await mask.apply();
    const releaseScreenshot = await mask.apply();

    releaseScreenshot();
    releaseScreenshot();
    expect(document.documentElement.hasAttribute(CAPTURE_ATTRIBUTE)).toBe(true);

    releaseRecording();
    expect(document.documentElement.hasAttribute(CAPTURE_ATTRIBUTE)).toBe(false);
  });
});
