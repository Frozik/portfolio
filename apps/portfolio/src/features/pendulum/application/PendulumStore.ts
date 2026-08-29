import type { ISO } from '@frozik/utils/date/types';
import { EValueDescriptorErrorCode } from '@frozik/utils/value-descriptors/codes';
import { Fail } from '@frozik/utils/value-descriptors/fails/fail';
import { toFail } from '@frozik/utils/value-descriptors/fails/utils';
import type { ValueDescriptor } from '@frozik/utils/value-descriptors/types';
import {
  createSyncedValueDescriptor,
  createUnsyncedValueDescriptor,
  EMPTY_VD,
  isSyncedValueDescriptor,
  REQUESTING_VD,
  WAITING_VD,
} from '@frozik/utils/value-descriptors/utils';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, reaction, runInAction } from 'mobx';

import type { IGeneration } from '../domain/defs';
import { TensorflowPlayer } from '../domain/players/TensorflowPlayer';
import type { ICompetition } from '../domain/types';
import type { TModuleIndexDBGenerations } from '../infrastructure/IndexedDBGenerationsRepository';
import { createIndexDBGenerationsModule } from '../infrastructure/IndexedDBGenerationsRepository';
import { createFitnessCompetition } from './createFitnessCompetition';

const DEFAULT_GRAVITY = 1;

export class PendulumStore {
  playgroundGravity: number = DEFAULT_GRAVITY;
  gravity: number = DEFAULT_GRAVITY;
  paused: boolean = true;
  competitionsList: ValueDescriptor<ISO[]> = WAITING_VD;
  currentCompetition: ValueDescriptor<{
    competitionStart: ISO;
    generations: IGeneration[];
  }> = WAITING_VD;
  currentRobotId: string | undefined = undefined;
  currentRobot: ValueDescriptor<TensorflowPlayer> = WAITING_VD;
  isNeuralNetworkDialogOpen: boolean = false;
  competition: ICompetition | undefined = undefined;

  dbModule: TModuleIndexDBGenerations | undefined = undefined;

  private readonly disposers: (() => void)[] = [];
  private loadCompetitionSub?: () => void;
  private loadRobotSub?: () => void;

  constructor() {
    makeAutoObservable<PendulumStore, 'disposers' | 'loadCompetitionSub' | 'loadRobotSub'>(
      this,
      {
        disposers: false,
        loadCompetitionSub: false,
        loadRobotSub: false,
        // The competition is a stateful orchestrator, not a data bag: deep
        // observability would turn its `generationsCount` getter into a cached
        // computed over a plain closure counter and never invalidate it.
        competition: observableRef,
      },
      { autoBind: true }
    );

    // Initialize IndexedDB module immediately in constructor.
    // Runs once per store instance; subscriptions are torn down in dispose().
    this.initGenerationsSync();

    // Keyed on the competition start alone — appending a generation must not
    // rebuild the running competition (that would restart the playground).
    this.disposers.push(
      reaction(
        () =>
          isSyncedValueDescriptor(this.currentCompetition)
            ? this.currentCompetition.value.competitionStart
            : undefined,
        this.syncCompetition,
        { fireImmediately: true }
      )
    );
  }

  setPlaygroundGravity(g: number): void {
    this.playgroundGravity = g;
  }

  setGravity(g: number): void {
    this.gravity = g;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  setCompetitionsList(vd: ValueDescriptor<ISO[]>): void {
    this.competitionsList = vd;
  }

  setCurrentCompetition(
    vd: ValueDescriptor<{ competitionStart: ISO; generations: IGeneration[] }>
  ): void {
    this.currentCompetition = vd;
  }

  get generations(): IGeneration[] {
    if (isSyncedValueDescriptor(this.currentCompetition)) {
      return this.currentCompetition.value.generations;
    }
    return [];
  }

  get maxPopulationSize(): number {
    return this.generations.reduce((acc, { players: { length } }) => Math.max(acc, length), 0);
  }

  addCompetitionRun(data: { competitionStart: ISO; generation: IGeneration }): void {
    if (isSyncedValueDescriptor(this.currentCompetition)) {
      this.currentCompetition = createSyncedValueDescriptor({
        ...this.currentCompetition.value,
        generations: [...this.currentCompetition.value.generations, data.generation],
      });
    }

    if (!isNil(this.dbModule)) {
      this.dbModule
        .addGeneration$(data.competitionStart, data.generation)
        .catch((error: unknown) => {
          runInAction(() => {
            this.currentCompetition = createUnsyncedValueDescriptor(toFail(error));
          });
        });
    }
  }

  deleteCompetition(start: ISO): void {
    if (isNil(this.dbModule)) {
      return;
    }

    const isCurrent =
      isSyncedValueDescriptor(this.currentCompetition) &&
      this.currentCompetition.value.competitionStart === start;

    this.dbModule.deleteCompetition$(start).catch((error: unknown) => {
      runInAction(() => {
        this.currentCompetition = createUnsyncedValueDescriptor(toFail(error));
      });
    });

    if (isCurrent) {
      this.loadCompetitionSub?.();
      this.loadCompetitionSub = undefined;
      this.currentCompetition = EMPTY_VD;
    }
  }

  loadCompetition(start: ISO): void {
    if (isNil(this.dbModule)) {
      return;
    }

    this.loadCompetitionSub?.();

    this.currentCompetition = REQUESTING_VD;

    const obs$ = this.dbModule.getGenerations$(start);

    const sub = obs$.subscribe({
      next: (generations: IGeneration[]) => {
        runInAction(() => {
          // The DB snapshot may lag behind optimistic appends from
          // addCompetitionRun (persistence is fire-and-forget and slow while
          // TF training saturates the main thread). Replacing the list
          // wholesale would briefly drop freshly computed generations — keep
          // the optimistic tail that the snapshot does not know about yet.
          const snapshotMaxId =
            generations.length > 0
              ? generations[generations.length - 1].id
              : Number.NEGATIVE_INFINITY;
          const optimisticTail =
            isSyncedValueDescriptor(this.currentCompetition) &&
            this.currentCompetition.value.competitionStart === start
              ? this.currentCompetition.value.generations.filter(
                  generation => generation.id > snapshotMaxId
                )
              : [];

          this.currentCompetition = createSyncedValueDescriptor({
            competitionStart: start,
            generations: [...generations, ...optimisticTail],
          });
        });
      },
      error: (error: unknown) => {
        runInAction(() => {
          this.currentCompetition = createUnsyncedValueDescriptor(toFail(error));
        });
      },
    });

    this.loadCompetitionSub = () => sub.unsubscribe();
  }

  setSelectedRobotId(robotId: string | undefined): void {
    this.loadRobot(robotId);
  }

  openNeuralNetworkDialog(robotId: string): void {
    this.loadRobot(robotId);
    this.isNeuralNetworkDialogOpen = true;
  }

  closeNeuralNetworkDialog(): void {
    this.isNeuralNetworkDialogOpen = false;
  }

  loadRobot(robotId: string | undefined): void {
    this.loadRobotSub?.();
    this.loadRobotSub = undefined;

    this.currentRobotId = robotId;

    if (isNil(robotId) || isNil(this.dbModule)) {
      this.currentRobot = WAITING_VD;
      return;
    }

    this.currentRobot = REQUESTING_VD;

    const sub = this.dbModule.getRobot$(robotId).subscribe({
      next: robot => {
        if (isNil(robot)) {
          runInAction(() => {
            this.currentRobot = createUnsyncedValueDescriptor(
              Fail(EValueDescriptorErrorCode.NOT_FOUND, {
                message: 'Robot not found',
                description: `Robot "${robotId}" not found in database`,
              })
            );
          });
          return;
        }

        void TensorflowPlayer.load(robot.name, robot.modelUrl).then(
          player => {
            runInAction(() => {
              this.currentRobot = createSyncedValueDescriptor(player);
            });
          },
          error => {
            runInAction(() => {
              this.currentRobot = createUnsyncedValueDescriptor(toFail(error));
            });
          }
        );
      },
      error: error => {
        runInAction(() => {
          this.currentRobot = createUnsyncedValueDescriptor(toFail(error));
        });
      },
    });

    this.loadRobotSub = () => sub.unsubscribe();
  }

  dispose(): void {
    this.loadRobotSub?.();
    this.loadRobotSub = undefined;
    this.loadCompetitionSub?.();
    this.loadCompetitionSub = undefined;

    for (const disposer of this.disposers) {
      disposer();
    }
    this.disposers.length = 0;
  }

  private syncCompetition(competitionStart: ISO | undefined): void {
    if (isNil(competitionStart)) {
      this.competition = undefined;
      return;
    }

    this.competition = createFitnessCompetition({
      competitionStart,
      getGenerations: () => this.generations,
      onGenerationCompleted: generation => this.addCompetitionRun({ competitionStart, generation }),
    });
  }

  private initGenerationsSync(): void {
    void createIndexDBGenerationsModule()
      .then(dbModule => {
        runInAction(() => {
          this.dbModule = dbModule;

          // If robotId was set before dbModule was ready, retry loading
          if (!isNil(this.currentRobotId)) {
            this.loadRobot(this.currentRobotId);
          }
        });

        const sub = dbModule.getCompetitionsStarts$().subscribe({
          next: (starts: ISO[]) => {
            runInAction(() => {
              this.competitionsList =
                starts.length > 0 ? createSyncedValueDescriptor(starts) : EMPTY_VD;
            });
          },
          error: (error: unknown) => {
            runInAction(() => {
              this.competitionsList = createUnsyncedValueDescriptor(toFail(error));
            });
          },
        });

        this.disposers.push(() => sub.unsubscribe());
      })
      .catch((error: unknown) => {
        runInAction(() => {
          this.competitionsList = createUnsyncedValueDescriptor(toFail(error));
        });
      });
  }
}
