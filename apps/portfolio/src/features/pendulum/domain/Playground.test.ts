import { Playground } from './Playground';
import type { IAction, IHumanPlayer, IRenderer, ITicker, IWorld } from './types';
import { EPlayerType } from './types';

function createTicker(): ITicker {
  return {
    subscribe: () => () => undefined,
    dispose: () => undefined,
  };
}

function createPlayer(): IHumanPlayer {
  return {
    type: EPlayerType.Human,
    name: 'test',
    play(): IAction {
      return { pivotVelocity: 0 };
    },
    dispose: () => undefined,
  };
}

function createRenderer(): IRenderer {
  return {
    renderStatic: () => undefined,
    render: (_worlds: IWorld[]) => undefined,
  };
}

describe('Playground render debounce', () => {
  let rafCallbacks: FrameRequestCallback[];
  let rafSpy: ReturnType<typeof vi.fn>;
  let cancelSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rafCallbacks = [];
    let nextId = 1;
    rafSpy = vi.fn((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return nextId++;
    });
    cancelSpy = vi.fn();
    vi.stubGlobal('requestAnimationFrame', rafSpy);
    vi.stubGlobal('cancelAnimationFrame', cancelSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('schedules exactly one frame when render is triggered repeatedly before the frame fires', async () => {
    const playground = new Playground(createTicker());
    await playground.setRenderer(createRenderer());

    // Adding several players in the same tick triggers render() each time, but
    // only one rAF must be scheduled while a frame is already queued.
    await playground.addPlayer(createPlayer());
    await playground.addPlayer(createPlayer());
    await playground.addPlayer(createPlayer());

    expect(rafSpy).toHaveBeenCalledTimes(1);
  });

  it('schedules a new frame only after the queued frame fires', async () => {
    const playground = new Playground(createTicker());
    await playground.setRenderer(createRenderer());

    await playground.addPlayer(createPlayer());
    expect(rafSpy).toHaveBeenCalledTimes(1);

    // Fire the queued frame, which clears the queued-frame id.
    await rafCallbacks[0](performance.now());

    await playground.addPlayer(createPlayer());
    expect(rafSpy).toHaveBeenCalledTimes(2);
  });

  it('does not schedule a frame without a renderer', async () => {
    const playground = new Playground(createTicker());

    await playground.addPlayer(createPlayer());

    expect(rafSpy).not.toHaveBeenCalled();
  });

  it('cancels a queued frame on destroy', async () => {
    const playground = new Playground(createTicker());
    await playground.setRenderer(createRenderer());
    await playground.addPlayer(createPlayer());

    playground.destroy();

    expect(cancelSpy).toHaveBeenCalledTimes(1);
  });
});
