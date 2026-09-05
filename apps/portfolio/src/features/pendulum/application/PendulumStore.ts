import { getNowISO8601 } from '@frozik/utils/date/now';
import type { ISO } from '@frozik/utils/date/types';
import { EValueDescriptorErrorCode } from '@frozik/utils/value-descriptors/codes';
import { ValueDescriptorError } from '@frozik/utils/value-descriptors/fails/error';
import { toFail } from '@frozik/utils/value-descriptors/fails/utils';
import type { ValueDescriptor } from '@frozik/utils/value-descriptors/types';
import {
  createSyncedValueDescriptor,
  createUnsyncedValueDescriptor,
  EMPTY_VD,
  isFailValueDescriptor,
  isLoadingValueDescriptor,
  isSyncedValueDescriptor,
  REQUESTING_VD,
  WAITING_VD,
} from '@frozik/utils/value-descriptors/utils';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, reaction, runInAction } from 'mobx';

import type { IGeneration } from '../domain/generation';
import { maxPopulationSize, mergeSnapshotWithOptimisticTail } from '../domain/generation';
import { HumanPlayer } from '../domain/players/HumanPlayer';
import type { IFrameScheduler } from '../domain/ports/frame-scheduler';
import type { IGenerationsRepository, IRobotRecord } from '../domain/ports/generations-repository';
import type { IKeyStateSource } from '../domain/ports/key-state-source';
import { randomizedSubsteps, realTimeStep } from '../domain/simulation-speed';
import type { ICompetition, IRobotPlayer } from '../domain/types';
import { createFitnessCompetition } from './createFitnessCompetition';
import { PlaygroundSession } from './PlaygroundSession';

interface IPendulumStoreDependencies {
  readonly repository: IGenerationsRepository;
  readonly frames: IFrameScheduler;
  readonly createKeyStateSource: () => IKeyStateSource;
  readonly loadRobot: (record: IRobotRecord) => Promise<IRobotPlayer>;
}

export class PendulumStore {
  competitionsList: ValueDescriptor<readonly ISO[]> = WAITING_VD;
  /** Generations of the open competition; WAITING while none is open. */
  generations: ValueDescriptor<readonly IGeneration[]> = WAITING_VD;
  /** The running orchestrator of the open competition, created once its generations are known. */
  competition: ICompetition | undefined = undefined;
  /** The robot picked from the generations table; WAITING when a human plays instead. */
  selectedRobot: ValueDescriptor<IRobotPlayer> = WAITING_VD;
  isNeuralNetworkDialogOpen = false;

  readonly fitness: PlaygroundSession;
  readonly test: PlaygroundSession;

  private readonly disposers: VoidFunction[] = [];
  private unwatchGenerations: VoidFunction | undefined;
  private robotLoadToken = 0;

  constructor(private readonly dependencies: IPendulumStoreDependencies) {
    this.fitness = new PlaygroundSession(dependencies.frames, (_, multiplier) =>
      randomizedSubsteps(multiplier)
    );
    this.test = new PlaygroundSession(dependencies.frames, realTimeStep);

    makeAutoObservable<
      PendulumStore,
      'dependencies' | 'disposers' | 'unwatchGenerations' | 'robotLoadToken'
    >(
      this,
      {
        dependencies: false,
        disposers: false,
        unwatchGenerations: false,
        robotLoadToken: false,
        fitness: false,
        test: false,
        competition: observableRef,
        selectedRobot: observableRef,
      },
      { autoBind: true }
    );

    this.disposers.push(
      dependencies.repository.watchCompetitionStarts({
        next: starts => {
          runInAction(() => {
            this.competitionsList =
              starts.length > 0 ? createSyncedValueDescriptor(starts) : EMPTY_VD;
          });
        },
        error: error => {
          runInAction(() => {
            this.competitionsList = createUnsyncedValueDescriptor(toFail(error));
          });
        },
      }),
      reaction(() => this.competition, this.runCompetition),
      reaction(() => this.selectedRobot, this.runTestPlayer, { fireImmediately: true })
    );
  }

  get maxPopulationSize(): number {
    return maxPopulationSize(this.syncedGenerations);
  }

  private get syncedGenerations(): readonly IGeneration[] {
    return isSyncedValueDescriptor(this.generations) ? this.generations.value : [];
  }

  createCompetition(): void {
    const competitionStart = getNowISO8601();

    this.closeCompetition();
    this.generations = createSyncedValueDescriptor([]);
    this.competition = this.buildCompetition(competitionStart);
    this.fitness.setPaused(false);
  }

  loadCompetition(competitionStart: ISO): void {
    this.closeCompetition();
    this.generations = REQUESTING_VD;

    this.unwatchGenerations = this.dependencies.repository.watchGenerations(competitionStart, {
      next: snapshot => {
        runInAction(() => {
          this.generations = createSyncedValueDescriptor(
            mergeSnapshotWithOptimisticTail(snapshot, this.syncedGenerations)
          );
          this.competition ??= this.buildCompetition(competitionStart);
        });
      },
      error: error => {
        runInAction(() => {
          this.generations = createUnsyncedValueDescriptor(toFail(error));
        });
      },
    });
    this.fitness.setPaused(false);
  }

  deleteCompetition(competitionStart: ISO): void {
    if (this.competition?.start === competitionStart) {
      this.closeCompetition();
      this.fitness.setPaused(true);
    }

    this.dependencies.repository.deleteCompetition(competitionStart).catch((error: unknown) => {
      runInAction(() => {
        this.generations = createUnsyncedValueDescriptor(toFail(error));
      });
    });
  }

  selectRobot(robotName: string | undefined): void {
    const token = ++this.robotLoadToken;

    if (isNil(robotName)) {
      this.selectedRobot = WAITING_VD;
      return;
    }

    this.selectedRobot = REQUESTING_VD;

    this.dependencies.repository
      .findRobot(robotName)
      .then(record => {
        if (isNil(record)) {
          throw new ValueDescriptorError(
            'Robot not found',
            EValueDescriptorErrorCode.NOT_FOUND,
            `Robot "${robotName}" not found in database`
          );
        }
        return this.dependencies.loadRobot(record);
      })
      .then(
        player => {
          if (token !== this.robotLoadToken) {
            player.dispose();
            return;
          }
          runInAction(() => {
            this.selectedRobot = createSyncedValueDescriptor(player);
          });
        },
        (error: unknown) => {
          if (token !== this.robotLoadToken) {
            return;
          }
          runInAction(() => {
            this.selectedRobot = createUnsyncedValueDescriptor(toFail(error));
          });
        }
      );
  }

  openNeuralNetworkDialog(robotName: string): void {
    this.selectRobot(robotName);
    this.isNeuralNetworkDialogOpen = true;
  }

  closeNeuralNetworkDialog(): void {
    this.isNeuralNetworkDialogOpen = false;
  }

  dispose(): void {
    this.robotLoadToken++;
    this.closeCompetition();
    for (const disposer of this.disposers) {
      disposer();
    }
    this.disposers.length = 0;
    this.fitness.dispose();
    this.test.dispose();
  }

  private closeCompetition(): void {
    this.unwatchGenerations?.();
    this.unwatchGenerations = undefined;
    this.competition = undefined;
    this.generations = WAITING_VD;
  }

  private buildCompetition(competitionStart: ISO): ICompetition {
    return createFitnessCompetition({
      competitionStart,
      getGenerations: () => this.syncedGenerations,
      onGenerationCompleted: generation => this.appendGeneration(competitionStart, generation),
      saveRobotModel: (start, robot) => this.dependencies.repository.saveRobotModel(start, robot),
    });
  }

  private appendGeneration(competitionStart: ISO, generation: IGeneration): void {
    this.generations = createSyncedValueDescriptor([...this.syncedGenerations, generation]);

    this.dependencies.repository
      .addGeneration(competitionStart, generation)
      .catch((error: unknown) => {
        runInAction(() => {
          this.generations = createUnsyncedValueDescriptor(toFail(error));
        });
      });
  }

  private runCompetition(competition: ICompetition | undefined): void {
    this.fitness.playground.clear();
    if (isNil(competition)) {
      return;
    }

    this.fitness.playground.addCompetition(competition).catch((error: unknown) => {
      runInAction(() => {
        this.generations = createUnsyncedValueDescriptor(toFail(error));
      });
    });
  }

  private runTestPlayer(robot: ValueDescriptor<IRobotPlayer>): void {
    this.test.playground.clear();

    if (isSyncedValueDescriptor(robot)) {
      this.test.playground.addPlayer(robot.value);
    } else if (!isLoadingValueDescriptor(robot) && !isFailValueDescriptor(robot)) {
      this.test.playground.addPlayer(new HumanPlayer(this.dependencies.createKeyStateSource()));
    }
  }
}
