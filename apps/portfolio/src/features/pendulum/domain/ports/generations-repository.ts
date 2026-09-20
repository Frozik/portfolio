import type { ISO } from '@frozik/utils/date/types';

import type { IGeneration } from '../generation';
import type { INetworkSnapshot } from '../neural-network/DenseNetwork';

export interface IRobotRecord {
  readonly name: string;
  readonly network: INetworkSnapshot;
  readonly score: number;
}

export interface IRepositoryObserver<TValue> {
  next(value: TValue): void;
  error(error: unknown): void;
}

/** Persistence of competitions: their generations, robot records and robot networks. */
export interface IGenerationsRepository {
  /** Emits the known competition starts, newest first, and again after every change. */
  watchCompetitionStarts(observer: IRepositoryObserver<readonly ISO[]>): VoidFunction;
  /** Emits the generations of one competition, oldest first, and again after a delete. */
  watchGenerations(
    competitionStart: ISO,
    observer: IRepositoryObserver<readonly IGeneration[]>
  ): VoidFunction;
  addGeneration(competitionStart: ISO, generation: IGeneration): Promise<void>;
  deleteCompetition(competitionStart: ISO): Promise<void>;
  findRobot(robotName: string): Promise<IRobotRecord | undefined>;
}
