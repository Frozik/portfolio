import { TOUCH_HOLD_DELAY_MS, TOUCH_HOLD_SLOP_PX } from '../domain/constants';
import { TouchHold } from './touch-hold';

function harness() {
  const held: { x: number; y: number }[] = [];
  let releases = 0;
  const hold = new TouchHold(
    position => held.push(position),
    () => {
      releases += 1;
    }
  );
  return { hold, held, releases: () => releases };
}

describe('touch hold on the chart', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds where the finger rests once the delay passes, and lets it go on lift', () => {
    const { hold, held, releases } = harness();
    hold.begin({ x: 100, y: 50 });
    expect(hold.move({ x: 102, y: 51 })).toBe(true);
    expect(held).toEqual([]);

    vi.advanceTimersByTime(TOUCH_HOLD_DELAY_MS);
    expect(held).toEqual([{ x: 100, y: 50 }]);
    expect(hold.isHolding).toBe(true);
    expect(hold.move({ x: 300, y: 80 })).toBe(true);

    hold.end();
    expect(releases()).toBe(1);
    expect(hold.isHolding).toBe(false);
  });

  it('becomes a pan when the finger travels before the delay', () => {
    const { hold, held, releases } = harness();
    hold.begin({ x: 100, y: 50 });
    expect(hold.move({ x: 100 + TOUCH_HOLD_SLOP_PX + 1, y: 50 })).toBe(false);

    vi.advanceTimersByTime(TOUCH_HOLD_DELAY_MS);
    expect(held).toEqual([]);
    expect(hold.move({ x: 200, y: 50 })).toBe(false);

    hold.end();
    expect(releases()).toBe(0);
  });

  it('is cut short by a second finger before the delay and starts over on the next touch', () => {
    const { hold, held } = harness();
    hold.begin({ x: 100, y: 50 });
    hold.end();
    vi.advanceTimersByTime(TOUCH_HOLD_DELAY_MS);
    expect(held).toEqual([]);

    hold.begin({ x: 10, y: 20 });
    vi.advanceTimersByTime(TOUCH_HOLD_DELAY_MS);
    expect(held).toEqual([{ x: 10, y: 20 }]);
  });
});
