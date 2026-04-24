import type { ISO } from '@frozik/utils/date/types';
import type { Body, Engine } from 'matter-js';

export interface IWorld {
  engine: Engine;
  pivot: Body;
  bobs: Body[];
}

export interface IPendulumOptions {
  bobsCount: number;
  pivotPosition?: number;
}

export interface IAction {
  pivotVelocity: number;
}

export enum EPlayerType {
  Human = 'human',
  Robot = 'robot',
}

export type TPlayer = IHumanPlayer | IRobotPlayer;

export interface IHumanPlayer {
  readonly type: EPlayerType;
  readonly name: string;

  play(world: IWorld, deltaTime: DOMHighResTimeStamp): Promise<IAction> | IAction;

  dispose(): void;
}

export interface IRobotPlayer {
  readonly type: EPlayerType.Robot;
  readonly name: string;

  play(world: IWorld, deltaTime: DOMHighResTimeStamp): Promise<IAction> | IAction;

  mutate(mutationRate?: number): Promise<IRobotPlayer>;
  crossoverModels?(secondParent: IRobotPlayer): Promise<IRobotPlayer>;

  save(url: string): Promise<void>;

  dispose(): void;
}

export interface ITicker {
  subscribe(handler: (deltaTime: DOMHighResTimeStamp) => Promise<void> | void): VoidFunction;

  dispose(): void;
}

export interface IRenderer {
  renderStatic(): Promise<void> | void;
  render(
    worlds: IWorld[],
    additionalForcePosition?: { x: number; y: number }
  ): Promise<void> | void;
}

export interface ICompetition {
  readonly start: ISO;

  get generationsCount(): number;

  init(): Promise<TPlayer[]> | TPlayer[];

  scoreCalculatorBuilder(world: IWorld): (deltaTime: DOMHighResTimeStamp) => number;

  competitionCompleted(timeStep: DOMHighResTimeStamp, playersWithScore: IScoredPlayer[]): boolean;

  competitionForPlayerCompleted?(player: TPlayer, score: number): boolean;

  restartCompetition(
    playersWithScore: IScoredPlayer[],
    timeStep: DOMHighResTimeStamp
  ):
    | false
    | (TPlayer | { player: TPlayer; pendulumOptions: Partial<IPendulumOptions> })[]
    | Promise<
        false | (TPlayer | { player: TPlayer; pendulumOptions: Partial<IPendulumOptions> })[]
      >;

  dispose?(): void;
}

export interface IScoredPlayer<T extends TPlayer = TPlayer> {
  player: T;
  score: number;
}
