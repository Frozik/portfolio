import { describe, expect, it } from 'vitest';

import { EmotionHysteresis } from './emotion-hysteresis';

describe('EmotionHysteresis', () => {
  it('starts neutral and stays put on a single stray detection', () => {
    const hysteresis = new EmotionHysteresis();

    expect(hysteresis.observe('happy')).toBeUndefined();
    expect(hysteresis.current).toBe('neutral');
  });

  it('commits an emotion seen on two consecutive detections', () => {
    const hysteresis = new EmotionHysteresis();

    hysteresis.observe('happy');

    expect(hysteresis.observe('happy')).toBe('happy');
    expect(hysteresis.current).toBe('happy');
  });

  it('restarts the count when the candidate changes between detections', () => {
    const hysteresis = new EmotionHysteresis();

    hysteresis.observe('happy');
    hysteresis.observe('surprised');

    expect(hysteresis.observe('happy')).toBeUndefined();
    expect(hysteresis.current).toBe('neutral');
  });

  it('reports a commit once and holds silently afterwards', () => {
    const hysteresis = new EmotionHysteresis();

    hysteresis.observe('happy');
    hysteresis.observe('happy');

    expect(hysteresis.observe('happy')).toBeUndefined();
  });
});
