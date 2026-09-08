import type { ISO } from '@frozik/utils/date/types';
import type { Opaque } from '@frozik/utils/types/base';

import type { TLayerDescriptor } from './neural-network/types';

/**
 * Storage address of a persisted robot network. Minted and resolved only by
 * the generations repository; the domain carries it around unopened.
 */
export type RobotModelUrl = Opaque<'RobotModelUrl', string>;

export interface IPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * A pendulum on its rails as an immutable value: the pivot's rail position
 * and velocity plus one angle (from the downward vertical, y pointing down)
 * and angular velocity per rod. Cartesian bob data is derived by
 * `physics/kinematics`. Lengths are px, time is ms.
 */
export interface IWorld {
  readonly pivotX: number;
  readonly pivotVelocity: number;
  readonly angles: readonly number[];
  readonly angularVelocities: readonly number[];
}

/** What acts on every world of a playground besides its player: the gravity slider and the pointer push. */
export interface IEnvironment {
  readonly gravity: number;
  readonly pointerPosition: IPoint | undefined;
}

export interface IPendulumOptions {
  readonly bobsCount: number;
  readonly pivotPosition?: number;
}

export interface IAction {
  readonly pivotVelocity: number;
}

export enum EPlayerType {
  Human = 'human',
  Robot = 'robot',
}

export type TPlayer = IHumanPlayer | IRobotPlayer;

export interface IHumanPlayer {
  readonly type: EPlayerType.Human;
  readonly name: string;

  play(world: IWorld, deltaTime: DOMHighResTimeStamp): IAction;

  dispose(): void;
}

export interface IRobotPlayer {
  readonly type: EPlayerType.Robot;
  readonly name: string;

  play(world: IWorld, deltaTime: DOMHighResTimeStamp): IAction;

  mutate(mutationRate?: number): Promise<IRobotPlayer>;
  crossoverModels(secondParent: IRobotPlayer): Promise<IRobotPlayer>;

  describeNetwork(): readonly TLayerDescriptor[];

  save(modelUrl: RobotModelUrl): Promise<void>;

  dispose(): void;
}

export interface ITicker {
  subscribe(handler: (deltaTime: DOMHighResTimeStamp) => Promise<void> | void): VoidFunction;
}

export interface IRenderer {
  renderStatic(): void;
  render(worlds: readonly IWorld[], pointerPosition: IPoint | undefined): void;
}

export interface IScoredPlayer<TScoredPlayer extends TPlayer = TPlayer> {
  readonly player: TScoredPlayer;
  readonly score: number;
}

export interface INextGenerationEntry {
  readonly player: TPlayer;
  readonly pendulumOptions?: Partial<IPendulumOptions>;
}

export type TCompetitionOutcome =
  | { readonly kind: 'finished' }
  | { readonly kind: 'nextGeneration'; readonly entries: readonly INextGenerationEntry[] };

export interface ICompetition {
  readonly start: ISO;

  init(): Promise<readonly TPlayer[]>;

  /** A fresh, stateful scorer for one run; called with the world after every step. */
  createScoreCalculator(): (world: IWorld, deltaTime: DOMHighResTimeStamp) => number;

  competitionCompleted(elapsed: DOMHighResTimeStamp): boolean;

  competitionForPlayerCompleted(player: TPlayer, score: number): boolean;

  restartCompetition(
    playersWithScore: readonly IScoredPlayer[],
    elapsed: DOMHighResTimeStamp
  ): Promise<TCompetitionOutcome>;
}

export function isScoredRobot(
  scoredPlayer: IScoredPlayer
): scoredPlayer is IScoredPlayer<IRobotPlayer> {
  return scoredPlayer.player.type === EPlayerType.Robot;
}
