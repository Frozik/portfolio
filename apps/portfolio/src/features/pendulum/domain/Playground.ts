import { isNil } from 'lodash-es';

import { createWorld } from './physics/createWorld';
import { DEFAULT_GRAVITY, setWorldGravity } from './physics/world-gravity';
import type { IPlaygroundEntry, IPlaygroundState } from './playground-step';
import {
  advancePlayground,
  applyCompetitionOutcome,
  disposeOutcomePlayers,
  EMPTY_PLAYGROUND_STATE,
  findSettledCompetitions,
  scoredMembersOf,
} from './playground-step';
import type { IFrameScheduler } from './ports/frame-scheduler';
import type {
  ICompetition,
  INextGenerationEntry,
  IPendulumOptions,
  IPoint,
  IRenderer,
  ITicker,
  TPlayer,
} from './types';

const DEFAULT_PENDULUM_OPTIONS: IPendulumOptions = { bobsCount: 1 };

/**
 * The set of pendulum worlds advanced together by one ticker. Owns every
 * player it holds and disposes them when they leave.
 */
export class Playground {
  private state: IPlaygroundState = EMPTY_PLAYGROUND_STATE;
  private gravity = DEFAULT_GRAVITY;
  private pointerForce: IPoint | undefined;
  private renderer: IRenderer | undefined;
  private cancelQueuedFrame: VoidFunction | undefined;
  private unsubscribeTicker: VoidFunction | undefined;

  constructor(
    private readonly ticker: ITicker,
    private readonly frames: IFrameScheduler,
    private readonly defaultPendulumOptions: IPendulumOptions = DEFAULT_PENDULUM_OPTIONS
  ) {}

  addPlayer(player: TPlayer, pendulumOptions?: Partial<IPendulumOptions>): void {
    const options = { ...this.defaultPendulumOptions, ...pendulumOptions };

    this.state = {
      ...this.state,
      entries: [
        ...this.state.entries,
        {
          player,
          world: createWorld(options, this.gravity),
          active: true,
          membership: undefined,
          score: 0,
        },
      ],
    };

    this.requestRender();
    this.startTicking();
  }

  async addCompetition(
    competition: ICompetition,
    pendulumOptions?: Partial<IPendulumOptions>
  ): Promise<void> {
    const players = await competition.init();

    this.state = {
      entries: [
        ...this.state.entries,
        ...players.map(player => this.spawnEntry(competition, { player, pendulumOptions })),
      ],
      competitions: [...this.state.competitions, { competition, elapsed: 0 }],
    };

    this.requestRender();
    this.startTicking();
  }

  clear(): void {
    this.unsubscribeTicker?.();
    this.unsubscribeTicker = undefined;

    for (const { player } of this.state.entries) {
      player.dispose();
    }
    this.state = EMPTY_PLAYGROUND_STATE;

    this.requestRender();
  }

  setRenderer(renderer: IRenderer | undefined): void {
    this.renderer = renderer;
    this.requestRender();
  }

  setPointerForce(pointerForce: IPoint | undefined): void {
    this.pointerForce = pointerForce;
  }

  setGravity(gravity: number): void {
    this.gravity = gravity;
    for (const { world } of this.state.entries) {
      setWorldGravity(world, gravity);
    }
  }

  destroy(): void {
    this.renderer = undefined;
    this.cancelQueuedFrame?.();
    this.cancelQueuedFrame = undefined;
    this.clear();
  }

  private async tick(deltaTime: DOMHighResTimeStamp): Promise<void> {
    this.state = advancePlayground(this.state, deltaTime, this.pointerForce);

    for (const settled of findSettledCompetitions(this.state)) {
      const outcome = await settled.competition.restartCompetition(
        scoredMembersOf(this.state, settled.competition),
        settled.elapsed
      );

      // Breeding is slow; the playground may have been cleared meanwhile.
      if (!this.state.competitions.includes(settled)) {
        disposeOutcomePlayers(outcome);
        return;
      }

      this.state = applyCompetitionOutcome(this.state, settled, outcome, this.spawnEntry);
    }

    this.requestRender();
  }

  private readonly spawnEntry = (
    competition: ICompetition,
    { player, pendulumOptions }: INextGenerationEntry
  ): IPlaygroundEntry => {
    const world = createWorld({ ...this.defaultPendulumOptions, ...pendulumOptions }, this.gravity);

    return {
      player,
      world,
      active: true,
      membership: { competition, scoreOf: competition.scoreCalculatorBuilder(world) },
      score: 0,
    };
  };

  private requestRender(): void {
    // One frame per tick burst: the ticker may run many substeps per frame.
    if (isNil(this.renderer) || !isNil(this.cancelQueuedFrame)) {
      return;
    }

    this.cancelQueuedFrame = this.frames.requestFrame(() => {
      this.cancelQueuedFrame = undefined;

      if (isNil(this.renderer)) {
        return;
      }
      this.renderer.renderStatic();
      this.renderer.render(
        this.state.entries.map(({ world }) => world),
        this.pointerForce
      );
    });
  }

  private startTicking(): void {
    this.unsubscribeTicker ??= this.ticker.subscribe(deltaTime => this.tick(deltaTime));
  }
}
