import { quantizedFps, smoothFrameDelta, startFrameLoop } from './frame-loop';
import { createFakeFrameScheduler } from './ports/fake-frame-scheduler.test-helper';

describe('startFrameLoop', () => {
  it('reports the time elapsed since the previous frame, skipping the first one', () => {
    const frames = createFakeFrameScheduler();
    const deltas: number[] = [];

    startFrameLoop(frames, deltaTime => {
      deltas.push(deltaTime);
    });
    frames.fire(100);
    frames.fire(116);
    frames.fire(133);

    expect(deltas).toEqual([16, 17]);
  });

  it('stops requesting frames once stopped', () => {
    const frames = createFakeFrameScheduler();
    const deltas: number[] = [];

    const stop = startFrameLoop(frames, deltaTime => {
      deltas.push(deltaTime);
    });
    frames.fire(100);
    stop();
    frames.fire(116);

    expect(deltas).toEqual([]);
    expect(frames.pendingCount()).toBe(0);
  });
});

describe('quantizedFps', () => {
  it('rounds the frame rate to the nearest five', () => {
    expect(quantizedFps(16.7)).toBe(60);
    expect(quantizedFps(18)).toBe(55);
  });
});

describe('smoothFrameDelta', () => {
  it('moves a tenth of the way towards the new sample', () => {
    expect(smoothFrameDelta(10, 20)).toBe(11);
  });
});
