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
  parseJson,
  REQUESTING_VD,
  WAITING_VD,
} from '@frozik/utils';
import type { SerializedDockview } from 'dockview';
import { isEqual, isNil } from 'lodash-es';
import { makeAutoObservable, runInAction } from 'mobx';

import type { CommonStore, IMenuAction } from '../../../app/stores/CommonStore';
import type { IGeneration } from '../domain/defs';
import { ALL_LAYOUTS, DEFAULT_LAYOUT, getLayout } from '../domain/layoutConfig';
import { TensorflowPlayer } from '../domain/players/TensorflowPlayer';
import type { TModuleIndexDBGenerations } from '../infrastructure/IndexedDBGenerationsRepository';
import { createIndexDBGenerationsModule } from '../infrastructure/IndexedDBGenerationsRepository';
import type { TModuleTabManager } from '../infrastructure/ModuleTabManager';
import { createTabManagerModule } from '../infrastructure/ModuleTabManager';

const PENDULUM_LAYOUT_KEY = '[settings] pendulum-layout';
const DEFAULT_GRAVITY = 1;

export class PendulumStore {
  layout: ValueDescriptor<SerializedDockview> = WAITING_VD;
  playgroundGravity: number = DEFAULT_GRAVITY;
  gravity: number = DEFAULT_GRAVITY;
  competitionsList: ValueDescriptor<ISO[]> = WAITING_VD;
  currentCompetition: ValueDescriptor<{
    competitionStart: ISO;
    generations: IGeneration[];
  }> = WAITING_VD;
  currentRobotId: string | undefined = undefined;
  currentRobot: ValueDescriptor<TensorflowPlayer> = WAITING_VD;

  readonly tabManager: TModuleTabManager = createTabManagerModule();
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
        tabManager: false,
      },
      { autoBind: true }
    );

    // Initialize IndexedDB module immediately in constructor.
    // This runs once when the store singleton is created — no lifecycle coupling.
    this.initGenerationsSync();
  }

  setLayout(vd: ValueDescriptor<SerializedDockview>): void {
    this.layout = vd;
  }

  setPlaygroundGravity(g: number): void {
    this.playgroundGravity = g;
  }

  setGravity(g: number): void {
    this.gravity = g;
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

  updateLayout(layout: SerializedDockview): void {
    localStorage.setItem(PENDULUM_LAYOUT_KEY, JSON.stringify(layout));
    this.updateMenuActions(layout);
  }

  loadCompetition(start: ISO): void {
    if (isNil(this.dbModule)) {
      return;
    }

    this.loadCompetitionSub?.();

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

  openTab(tabId: string): void {
    void this.tabManager.openTab({
      ...getLayout(tabId),
      position: {
        direction: 'below',
      },
    });
  }

  private initialized = false;

  init(): void {
    // Idempotent — safe to call multiple times (e.g. StrictMode double-mount).
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.initLayoutSync();
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

  private initLayoutSync(): void {
    const rawLayout = localStorage.getItem(PENDULUM_LAYOUT_KEY) as string | null;
    const initialLayout = parseJson(rawLayout) as SerializedDockview | undefined;
    const layout = isNil(initialLayout) ? DEFAULT_LAYOUT : initialLayout;

    this.layout = createSyncedValueDescriptor(layout);
    this.updateMenuActions(layout);

    let prevLayout: SerializedDockview | undefined = initialLayout;

    const storageHandler = ({ storageArea, key, newValue }: StorageEvent) => {
      const parsedLayout = parseJson<SerializedDockview>(newValue);

      if (
        storageArea === localStorage &&
        key === PENDULUM_LAYOUT_KEY &&
        !isNil(parsedLayout) &&
        !isEqual(prevLayout, parsedLayout)
      ) {
        prevLayout = parsedLayout;
        runInAction(() => {
          this.layout = createSyncedValueDescriptor(parsedLayout);
          this.updateMenuActions(parsedLayout);
        });
      }
    };

    window.addEventListener('storage', storageHandler, false);
    this.disposers.push(() => window.removeEventListener('storage', storageHandler, false));
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

  private updateMenuActions(layout: SerializedDockview): void {
    const allLayoutIds = ALL_LAYOUTS.map(({ id }) => id);
    const existingLayoutIds = new Set(Object.keys(layout.panels));
    const missingLayouts = allLayoutIds.filter(id => !existingLayoutIds.has(id));

    const menuActions: IMenuAction[] = missingLayouts.map(id => ({
      icon: getIconNameForTab(id),
      name: id,
      callback: () => this.openTab(id),
      tooltip: id,
    }));

    this.commonStore.setMenuActions(menuActions);
  }
}

function getIconNameForTab(tabId: string): string | undefined {
  switch (tabId) {
    case 'Test Playground':
      return 'eye';
    case 'Neural Network':
      return 'network';
    default:
      return undefined;
  }
}
