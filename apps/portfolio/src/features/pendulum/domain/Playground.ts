import { isNil } from 'lodash-es';
import { createWorld } from './physics/createWorld';
import { updateWorld } from './physics/updateWorld';
import type {
  ICompetition,
  IPendulumOptions,
  IRenderer,
  IScoredPlayer,
  ITicker,
  IWorld,
  TPlayer,
} from './types';

interface IPlaygroundItem {
  player: TPlayer;
  world: IWorld;
  pendulumOptions: IPendulumOptions;
  active: boolean;
  competition?: ICompetition;
  getScore?: (deltaTime: DOMHighResTimeStamp) => number;
  score: number;
}

interface IPlaygroundCompetition {
  competition: ICompetition;
  timeStamp: DOMHighResTimeStamp;
}

export class Playground {
  private _gravity = 1;
  private queueRenderFrameId: number | undefined;
  private tickerStarted = false;
  private playersWithWorlds: IPlaygroundItem[] = [];
  private competitions: IPlaygroundCompetition[] = [];
  private renderer?: IRenderer;
  private additionalForcePosition?: { x: number; y: number };

  constructor(
    private readonly ticker: ITicker,
    private readonly defaultPendulumOptions: IPendulumOptions = { bobsCount: 1 }
  ) {}

  private async tick(deltaTime: DOMHighResTimeStamp): Promise<void> {
    await Promise.all(
      this.playersWithWorlds.map(async item => {
        const { player, world, active, competition, getScore, score } = item;

        if (!active) {
          return;
        }

        const action = await player.play(world, deltaTime);

        updateWorld(world, deltaTime, action, this.additionalForcePosition);

        if (!isNil(getScore)) {
          item.score = score + getScore(deltaTime);
        }

        if (
          !isNil(competition) &&
          !isNil(competition.competitionForPlayerCompleted) &&
          competition.competitionForPlayerCompleted(player, item.score)
        ) {
          item.active = false;
          item.score = Number.NEGATIVE_INFINITY;
        }
      })
    );

    this.competitions.forEach(item => {
      item.timeStamp += deltaTime;

      if (item.competition.competitionCompleted(item.timeStamp, this.playersWithWorlds)) {
        this.playersWithWorlds.forEach(item => (item.active = false));
      }
    });

    const completedCompetitions = this.competitions.filter(({ competition }) =>
      this.playersWithWorlds.every(
        ({ competition: playerCompetition, active }) => playerCompetition !== competition || !active
      )
    );

    for (const completedCompetition of completedCompetitions) {
      const { competition } = completedCompetition;

      const playersWithScore = this.playersWithWorlds
        .filter(({ competition: playerCompetition }) => playerCompetition === competition)
        .map(({ player, score }): IScoredPlayer => ({ player, score }));

      const result = await competition.restartCompetition(
        playersWithScore,
        completedCompetition.timeStamp
      );

      completedCompetition.timeStamp = 0;

      this.playersWithWorlds = this.playersWithWorlds.filter(
        ({ competition: playerCompetition }) => playerCompetition !== competition
      );

      if (result !== false) {
        playersWithScore.forEach(({ player }) => {
          if (result.every(item => ('player' in item ? item.player !== player : item !== player))) {
            player.dispose();
          }
        });

        for (const item of result) {
          const { player, pendulumOptions } =
            'player' in item
              ? {
                  ...item,
                  pendulumOptions: {
                    ...this.defaultPendulumOptions,
                    ...item.pendulumOptions,
                  },
                }
              : { player: item, pendulumOptions: this.defaultPendulumOptions };

          const world = createWorld(pendulumOptions);
          world.engine.gravity.y = this._gravity;

          this.playersWithWorlds.push({
            player,
            world,
            pendulumOptions,
            active: true,
            competition,
            getScore: competition.scoreCalculatorBuilder(world),
            score: 0,
          });
        }
      } else {
        playersWithScore.forEach(({ player }) => player.dispose());
        this.competitions = this.competitions.filter(
          ({ competition: playerCompetition }) => playerCompetition !== competition
        );
        competition.dispose?.();
      }
    }

    await this.render();
  }

  private async render(): Promise<void> {
    if (!isNil(this.renderer) || !isNil(this.queueRenderFrameId)) {
      this.queueRenderFrameId = requestAnimationFrame(async () => {
        const renderer = this.renderer;

        if (!isNil(renderer)) {
          await renderer.renderStatic();

          await renderer.render(
            this.playersWithWorlds.map(({ world }) => world),
            this.additionalForcePosition
          );
        }

        this.queueRenderFrameId = undefined;
      });
    }
  }

  private startTicker() {
    if (!this.tickerStarted) {
      this.ticker.subscribe(deltaTime => this.tick(deltaTime));
      this.tickerStarted = true;
    }
  }

  public async addPlayer(
    player: TPlayer,
    pendulumOptions?: Partial<IPendulumOptions>
  ): Promise<void> {
    const options = { ...this.defaultPendulumOptions, ...pendulumOptions };

    const world = createWorld(options);
    world.engine.gravity.y = this._gravity;

    this.playersWithWorlds.push({
      player,
      world,
      active: true,
      score: 0,
      pendulumOptions: options,
    });

    await this.render();

    this.startTicker();
  }

  public async clear(): Promise<void> {
    this.ticker.dispose();
    this.tickerStarted = false;

    this.competitions.forEach(({ competition }) => competition.dispose?.());
    this.competitions = [];

    this.playersWithWorlds.forEach(({ player }) => player.dispose());
    this.playersWithWorlds = [];

    await this.render();
  }

  public async addCompetition(
    competition: ICompetition,
    pendulumOptions?: Partial<IPendulumOptions>
  ): Promise<void> {
    const options = { ...this.defaultPendulumOptions, ...pendulumOptions };

    const players = await competition.init();

    for (const player of players) {
      const world = createWorld(options);
      world.engine.gravity.y = this._gravity;

      this.playersWithWorlds.push({
        player,
        world,
        pendulumOptions: options,
        active: true,
        competition,
        getScore: competition.scoreCalculatorBuilder(world),
        score: 0,
      });
    }

    this.competitions.push({
      competition,
      timeStamp: 0,
    });

    await this.render();

    this.startTicker();
  }

  public async setRenderer(renderer: IRenderer | undefined): Promise<void> {
    this.renderer = renderer;
    await this.render();
  }

  public setAdditionalForcePosition(additionalForcePosition?: { x: number; y: number }) {
    this.additionalForcePosition = additionalForcePosition;
  }

  public destroy() {
    this.ticker.dispose();
    this.playersWithWorlds.forEach(({ player }) => player.dispose());
    this.competitions.forEach(({ competition }) => competition.dispose?.());
  }

  setGravity(gravity: number) {
    this._gravity = gravity;
    this.playersWithWorlds.map(({ world }) => (world.engine.gravity.y = gravity));
  }
}
