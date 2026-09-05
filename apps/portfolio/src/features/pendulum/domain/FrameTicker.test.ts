import { FrameTicker } from './FrameTicker';
import { realTimeStep } from './simulation-speed';

describe('FrameTicker', () => {
  it('hands every substep to every subscriber in order', async () => {
    const ticker = new FrameTicker((deltaTime, multiplier) =>
      Array.from({ length: multiplier }, () => deltaTime)
    );
    const received: number[] = [];
    ticker.subscribe(deltaTime => {
      received.push(deltaTime);
    });
    ticker.reportFps(60);

    await ticker.update(10);

    expect(received).toEqual([10, 10]);
  });

  it('skips a frame that arrives while the previous one is still simulating', async () => {
    const ticker = new FrameTicker(realTimeStep);
    let release: VoidFunction = () => undefined;
    const calls: number[] = [];
    ticker.subscribe(deltaTime => {
      calls.push(deltaTime);
      return new Promise<void>(resolve => {
        release = resolve;
      });
    });

    const first = ticker.update(1);
    await ticker.update(2);
    release();
    await first;

    expect(calls).toEqual([1]);
  });

  it('accepts frames again after a subscriber throws', async () => {
    const ticker = new FrameTicker(realTimeStep);
    let shouldThrow = true;
    const calls: number[] = [];
    ticker.subscribe(deltaTime => {
      calls.push(deltaTime);
      if (shouldThrow) {
        throw new Error('boom');
      }
    });

    await expect(ticker.update(1)).rejects.toThrow('boom');
    shouldThrow = false;
    await ticker.update(2);

    expect(calls).toEqual([1, 2]);
  });

  it('stops delivering to an unsubscribed handler', async () => {
    const ticker = new FrameTicker(realTimeStep);
    const calls: number[] = [];
    const unsubscribe = ticker.subscribe(deltaTime => {
      calls.push(deltaTime);
    });

    await ticker.update(1);
    unsubscribe();
    await ticker.update(2);

    expect(calls).toEqual([1]);
  });
});
