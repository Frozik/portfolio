import type { ISO, ValueDescriptor } from '@frozik/utils';
import {
  convertErrorToFail,
  createSyncedValueDescriptor,
  createUnsyncedValueDescriptor,
  EMPTY_VD,
  EValueDescriptorErrorCode,
  Fail,
  isSyncedValueDescriptor,
  matchValueDescriptor,
  REQUESTING_VD,
  WAITING_VD,
} from '@frozik/utils';
import { isNil } from 'lodash-es';
import { makeAutoObservable, runInAction } from 'mobx';

import type { CommonStore } from '../../../app/stores/CommonStore';
import type { IGeneration } from '../domain/defs';
import { TensorflowPlayer } from '../domain/players/TensorflowPlayer';
import type { TModuleIndexDBGenerations } from '../infrastructure/IndexedDBGenerationsRepository';
import { createIndexDBGenerationsModule } from '../infrastructure/IndexedDBGenerationsRepository';

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

  dbModule: TModuleIndexDBGenerations | undefined = undefined;

  private readonly commonStore: CommonStore;
  private readonly disposers: (() => void)[] = [];
  private loadCompetitionSub?: () => void;
  private loadRobotSub?: () => void;

  constructor(commonStore: CommonStore) {
    this.commonStore = commonStore;
    makeAutoObservable<
      PendulumStore,
      'commonStore' | 'disposers' | 'loadCompetitionSub' | 'loadRobotSub' | 'initialized'
    >(
      this,
      {
        commonStore: false,
        disposers: false,
        loadCompetitionSub: false,
        loadRobotSub: false,
        initialized: false,
      },
      { autoBind: true }
    );

    // Initialize IndexedDB module immediately in constructor.
    // This runs once when the store singleton is created — no lifecycle coupling.
    this.initGenerationsSync();
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
            this.currentCompetition = createUnsyncedValueDescriptor(
              convertErrorToFail(error instanceof Error ? error : new Error(String(error)))
            );
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
        this.currentCompetition = createUnsyncedValueDescriptor(
          convertErrorToFail(error instanceof Error ? error : new Error(String(error)))
        );
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
          this.currentCompetition = createSyncedValueDescriptor({
            competitionStart: start,
            generations,
          });
        });
      },
      error: (error: unknown) => {
        runInAction(() => {
          this.currentCompetition = createUnsyncedValueDescriptor(
            convertErrorToFail(error instanceof Error ? error : new Error(String(error)))
          );
        });
      },
    });

    this.loadCompetitionSub = () => sub.unsubscribe();
    this.disposers.push(this.loadCompetitionSub);
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
              this.currentRobot = createUnsyncedValueDescriptor(
                convertErrorToFail(error instanceof Error ? error : new Error(String(error)))
              );
            });
          }
        );
      },
      error: error => {
        runInAction(() => {
          this.currentRobot = createUnsyncedValueDescriptor(
            convertErrorToFail(error instanceof Error ? error : new Error(String(error)))
          );
        });
      },
    });

    this.loadRobotSub = () => sub.unsubscribe();
    this.disposers.push(this.loadRobotSub);
  }

  private initialized = false;

  init(): void {
    // Idempotent — safe to call multiple times (e.g. StrictMode double-mount).
    if (this.initialized) {
      return;
    }
    this.initialized = true;
  }

  dispose(): void {
    // Only dispose if actually initialized — prevents StrictMode
    // cleanup from destroying the store that will be re-init'd immediately.
    if (!this.initialized) {
      return;
    }
    this.initialized = false;
    this.loadRobotSub?.();
    this.loadRobotSub = undefined;

    for (const disposer of this.disposers) {
      disposer();
    }
    this.disposers.length = 0;
    this.commonStore.clearMenuActions();
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
              this.competitionsList = matchValueDescriptor(
                createSyncedValueDescriptor(starts) as ValueDescriptor<ISO[]>,
                ({ value }) => (value.length > 0 ? createSyncedValueDescriptor(value) : EMPTY_VD)
              );
            });
          },
          error: (error: unknown) => {
            runInAction(() => {
              this.competitionsList = createUnsyncedValueDescriptor(
                convertErrorToFail(error instanceof Error ? error : new Error(String(error)))
              );
            });
          },
        });

        this.disposers.push(() => sub.unsubscribe());
      })
      .catch((error: unknown) => {
        runInAction(() => {
          this.competitionsList = createUnsyncedValueDescriptor(
            convertErrorToFail(error instanceof Error ? error : new Error(String(error)))
          );
        });
      });
  }
}
