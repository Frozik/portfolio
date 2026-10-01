import { configure } from 'mobx';
import { describe, expect, it } from 'vitest';

import { SunStore } from './SunStore';

configure({ enforceActions: 'always' });

const FRAME_MS = 1000 / 60;
const VIEWPORT = { width: 800, height: 600, devicePixelRatio: 2 };

function runFrames(store: SunStore, fromMs: number, frames: number): number {
  let nowMs = fromMs;
  for (let frame = 0; frame < frames; frame += 1) {
    store.frame(nowMs);
    nowMs += FRAME_MS;
  }
  return nowMs;
}

describe('SunStore', () => {
  it('shows nothing measured until the display rate is read, then the rate and a count to try', () => {
    const store = new SunStore();
    expect(store.phase).toBe('calibrating');
    expect(store.refreshRate).toBeUndefined();
    expect(store.triangles).toBe(0);

    runFrames(store, 0, 120);

    expect(store.phase).toBe('searching');
    expect(store.refreshRate).toBe(60);
    expect(store.triangles).toBeGreaterThan(0);
  });

  it('starts the test over when asked to, and when the canvas changes size', () => {
    const store = new SunStore();
    const nowMs = runFrames(store, 0, 120);

    store.restart();
    expect(store.phase).toBe('calibrating');

    runFrames(store, nowMs, 120);
    store.resize(VIEWPORT);
    expect(store.phase).toBe('calibrating');
    expect(store.viewport).toEqual(VIEWPORT);
  });

  it('tells why there is no WebGPU', () => {
    const store = new SunStore();

    store.gpuMissing({ reason: 'no-adapter', detail: undefined });

    expect(store.gpu).toEqual({
      kind: 'unavailable',
      failure: { reason: 'no-adapter', detail: undefined },
    });
  });
});
