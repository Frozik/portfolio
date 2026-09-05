import type { Mock } from 'vitest';

import { Playground } from './Playground';
import { createFakeFrameScheduler } from './ports/fake-frame-scheduler.test-helper';
import type {
  IAction,
  ICompetition,
  IHumanPlayer,
  IPoint,
  IRenderer,
  IRobotPlayer,
  IScoredPlayer,
  ITicker,
  IWorld,
  TCompetitionOutcome,
} from './types';
import { EPlayerType } from './types';

interface IManualTicker extends ITicker {
  tick(deltaTime: DOMHighResTimeStamp): Promise<void>;
}

function createManualTicker(): IManualTicker {
  const handlers = new Set<(deltaTime: DOMHighResTimeStamp) => Promise<void> | void>();

  return {
    subscribe(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    async tick(deltaTime) {
      for (const handler of handlers) {
        await handler(deltaTime);
      }
    },
  };
}

type TDisposeSpy = Mock<() => undefined>;

function createHumanPlayer(name = 'human'): IHumanPlayer & { readonly dispose: TDisposeSpy } {
  return {
    type: EPlayerType.Human,
    name,
    play(): IAction {
      return { pivotVelocity: 0 };
    },
    dispose: vi.fn(() => undefined),
  };
}

function createRobot(name: string): IRobotPlayer & { readonly dispose: TDisposeSpy } {
  const robot: IRobotPlayer & { readonly dispose: TDisposeSpy } = {
    type: EPlayerType.Robot,
    name,
    play: () => ({ pivotVelocity: 0 }),
    mutate: async () => robot,
    crossoverModels: async () => robot,
    describeNetwork: () => [],
    save: async () => undefined,
    dispose: vi.fn(() => undefined),
  };
  return robot;
}

type TRenderSpy = Mock<(worlds: readonly IWorld[], pointerForce: IPoint | undefined) => undefined>;

function createRenderer(): IRenderer & { readonly render: TRenderSpy } {
  return {
    renderStatic: vi.fn(() => undefined),
    render: vi.fn((_worlds: readonly IWorld[], _pointerForce: IPoint | undefined) => undefined),
  };
}

function createCompetition({
  players,
  runLength,
  outcomes,
}: {
  readonly players: readonly IRobotPlayer[];
  readonly runLength: DOMHighResTimeStamp;
  readonly outcomes: (scored: readonly IScoredPlayer[]) => TCompetitionOutcome;
}): ICompetition & { readonly restarts: readonly (readonly IScoredPlayer[])[] } {
  const restarts: (readonly IScoredPlayer[])[] = [];
  return {
    start: '2026-01-01T00:00:00Z' as ICompetition['start'],
    restarts,
    init: async () => players,
    scoreCalculatorBuilder: () => deltaTime => deltaTime,
    competitionCompleted: elapsed => elapsed >= runLength,
    competitionForPlayerCompleted: () => false,
    async restartCompetition(scored) {
      restarts.push(scored);
      return outcomes(scored);
    },
  };
}

describe('Playground rendering', () => {
  it('queues exactly one frame however many players join before it fires', () => {
    const frames = createFakeFrameScheduler();
    const playground = new Playground(createManualTicker(), frames);
    playground.setRenderer(createRenderer());

    playground.addPlayer(createHumanPlayer());
    playground.addPlayer(createHumanPlayer());
    playground.addPlayer(createHumanPlayer());

    expect(frames.pendingCount()).toBe(1);
  });

  it('draws every world once the frame fires and queues the next one after that', () => {
    const frames = createFakeFrameScheduler();
    const renderer = createRenderer();
    const playground = new Playground(createManualTicker(), frames);
    playground.setRenderer(renderer);
    playground.addPlayer(createHumanPlayer());
    playground.addPlayer(createHumanPlayer());

    frames.fire(1);
    playground.addPlayer(createHumanPlayer());

    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(renderer.render.mock.calls[0][0]).toHaveLength(2);
    expect(frames.pendingCount()).toBe(1);
  });

  it('does not queue a frame without a renderer', () => {
    const frames = createFakeFrameScheduler();
    const playground = new Playground(createManualTicker(), frames);

    playground.addPlayer(createHumanPlayer());

    expect(frames.pendingCount()).toBe(0);
  });

  it('cancels the queued frame on destroy', () => {
    const frames = createFakeFrameScheduler();
    const playground = new Playground(createManualTicker(), frames);
    playground.setRenderer(createRenderer());
    playground.addPlayer(createHumanPlayer());

    playground.destroy();

    expect(frames.pendingCount()).toBe(0);
  });
});

describe('Playground players', () => {
  it('disposes its players when cleared', () => {
    const playground = new Playground(createManualTicker(), createFakeFrameScheduler());
    const player = createHumanPlayer();
    playground.addPlayer(player);

    playground.clear();

    expect(player.dispose).toHaveBeenCalledTimes(1);
  });

  it('stops ticking cleared players', async () => {
    const ticker = createManualTicker();
    const playground = new Playground(ticker, createFakeFrameScheduler());
    const player = createHumanPlayer();
    const play = vi.spyOn(player, 'play');
    playground.addPlayer(player);

    playground.clear();
    await ticker.tick(16);

    expect(play).not.toHaveBeenCalled();
  });
});

describe('Playground competitions', () => {
  it('asks the competition for the next generation once its run length elapsed', async () => {
    const ticker = createManualTicker();
    const playground = new Playground(ticker, createFakeFrameScheduler());
    const competition = createCompetition({
      players: [createRobot('a'), createRobot('b')],
      runLength: 100,
      outcomes: () => ({ kind: 'finished' }),
    });
    await playground.addCompetition(competition);

    await ticker.tick(60);
    expect(competition.restarts).toHaveLength(0);
    await ticker.tick(60);

    expect(competition.restarts).toHaveLength(1);
    expect(competition.restarts[0].map(({ player, score }) => [player.name, score])).toEqual([
      ['a', 120],
      ['b', 120],
    ]);
  });

  it('disposes the members the next generation dropped and keeps the survivors', async () => {
    const ticker = createManualTicker();
    const playground = new Playground(ticker, createFakeFrameScheduler());
    const survivor = createRobot('survivor');
    const dropped = createRobot('dropped');
    const child = createRobot('child');
    const competition = createCompetition({
      players: [survivor, dropped],
      runLength: 10,
      outcomes: () => ({
        kind: 'nextGeneration',
        entries: [{ player: survivor }, { player: child }],
      }),
    });
    await playground.addCompetition(competition);

    await ticker.tick(10);

    expect(dropped.dispose).toHaveBeenCalledTimes(1);
    expect(survivor.dispose).not.toHaveBeenCalled();
    expect(child.dispose).not.toHaveBeenCalled();
  });

  it('restarts the clock for the next generation', async () => {
    const ticker = createManualTicker();
    const playground = new Playground(ticker, createFakeFrameScheduler());
    const robot = createRobot('a');
    const competition = createCompetition({
      players: [robot],
      runLength: 10,
      outcomes: () => ({ kind: 'nextGeneration', entries: [{ player: robot }] }),
    });
    await playground.addCompetition(competition);

    await ticker.tick(10);
    await ticker.tick(5);
    expect(competition.restarts).toHaveLength(1);
    await ticker.tick(5);

    expect(competition.restarts).toHaveLength(2);
    expect(competition.restarts[1][0].score).toBe(10);
  });

  it('disposes every member and forgets a finished competition', async () => {
    const ticker = createManualTicker();
    const playground = new Playground(ticker, createFakeFrameScheduler());
    const robot = createRobot('a');
    const competition = createCompetition({
      players: [robot],
      runLength: 10,
      outcomes: () => ({ kind: 'finished' }),
    });
    await playground.addCompetition(competition);

    await ticker.tick(10);
    await ticker.tick(10);

    expect(robot.dispose).toHaveBeenCalledTimes(1);
    expect(competition.restarts).toHaveLength(1);
  });

  it('drops a generation bred for a competition that was cleared while breeding', async () => {
    const ticker = createManualTicker();
    const playground = new Playground(ticker, createFakeFrameScheduler());
    const robot = createRobot('a');
    const child = createRobot('child');
    let finishBreeding: VoidFunction = () => undefined;
    const competition = createCompetition({
      players: [robot],
      runLength: 10,
      outcomes: () => ({ kind: 'nextGeneration', entries: [{ player: child }] }),
    });
    const slowCompetition: ICompetition = {
      ...competition,
      restartCompetition: (scored, elapsed) =>
        new Promise(resolve => {
          finishBreeding = () => resolve(competition.restartCompetition(scored, elapsed));
        }),
    };
    await playground.addCompetition(slowCompetition);

    const tick = ticker.tick(10);
    playground.clear();
    finishBreeding();
    await tick;
    playground.addPlayer(createHumanPlayer());
    await ticker.tick(10);

    expect(child.dispose).toHaveBeenCalledTimes(1);
    expect(competition.restarts).toHaveLength(1);
  });

  it('halts a player the competition rules out and settles once every member halted', async () => {
    const ticker = createManualTicker();
    const playground = new Playground(ticker, createFakeFrameScheduler());
    const robot = createRobot('a');
    const competition: ICompetition = {
      ...createCompetition({
        players: [robot],
        runLength: 1000,
        outcomes: () => ({ kind: 'finished' }),
      }),
      competitionForPlayerCompleted: (_, score) => score >= 20,
    };
    const restart = vi.spyOn(competition, 'restartCompetition');
    await playground.addCompetition(competition);

    await ticker.tick(10);
    expect(restart).not.toHaveBeenCalled();
    await ticker.tick(10);

    expect(restart).toHaveBeenCalledTimes(1);
    expect(restart.mock.calls[0][0][0].score).toBe(Number.NEGATIVE_INFINITY);
  });
});
