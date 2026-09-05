import type { ISO } from '@frozik/utils/date/types';

import type { IGeneration } from '../domain/generation';
import type {
  IGenerationsRepository,
  IRepositoryObserver,
  IRobotRecord,
} from '../domain/ports/generations-repository';
import type { RobotModelUrl } from '../domain/types';

export interface IFakeGenerationsRepository extends IGenerationsRepository {
  readonly robots: Map<string, IRobotRecord>;
  readonly persisted: Map<ISO, IGeneration[]>;
  emitCompetitionStarts(starts: readonly ISO[]): void;
  emitGenerations(competitionStart: ISO, generations: readonly IGeneration[]): void;
  failGenerations(competitionStart: ISO, error: unknown): void;
  generationsWatchers(competitionStart: ISO): number;
}

export function createFakeGenerationsRepository(): IFakeGenerationsRepository {
  const startsObservers = new Set<IRepositoryObserver<readonly ISO[]>>();
  const generationsObservers = new Map<ISO, Set<IRepositoryObserver<readonly IGeneration[]>>>();
  const robots = new Map<string, IRobotRecord>();
  const persisted = new Map<ISO, IGeneration[]>();

  const observersOf = (competitionStart: ISO) => {
    let observers = generationsObservers.get(competitionStart);
    if (observers === undefined) {
      observers = new Set();
      generationsObservers.set(competitionStart, observers);
    }
    return observers;
  };

  return {
    robots,
    persisted,
    watchCompetitionStarts(observer) {
      startsObservers.add(observer);
      return () => startsObservers.delete(observer);
    },
    watchGenerations(competitionStart, observer) {
      const observers = observersOf(competitionStart);
      observers.add(observer);
      return () => observers.delete(observer);
    },
    async addGeneration(competitionStart, generation) {
      persisted.set(competitionStart, [...(persisted.get(competitionStart) ?? []), generation]);
    },
    async deleteCompetition(competitionStart) {
      persisted.delete(competitionStart);
    },
    async findRobot(robotName) {
      return robots.get(robotName);
    },
    async saveRobotModel(competitionStart, robot) {
      return `fake://${competitionStart}/${robot.name}` as RobotModelUrl;
    },
    emitCompetitionStarts(starts) {
      for (const observer of startsObservers) {
        observer.next(starts);
      }
    },
    emitGenerations(competitionStart, generations) {
      for (const observer of observersOf(competitionStart)) {
        observer.next(generations);
      }
    },
    failGenerations(competitionStart, error) {
      for (const observer of observersOf(competitionStart)) {
        observer.error(error);
      }
    },
    generationsWatchers(competitionStart) {
      return observersOf(competitionStart).size;
    },
  };
}
