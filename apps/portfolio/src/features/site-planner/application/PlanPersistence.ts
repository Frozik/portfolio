import { isNil } from 'lodash-es';
import type { IReactionDisposer } from 'mobx';
import { makeAutoObservable, reaction, runInAction } from 'mobx';

import type { SitePlan } from '../domain/model/site-plan';
import { parseSnapshot } from '../domain/model/snapshot';
import type { ISitePlanRepository } from '../domain/persistence/ISitePlanRepository';

/** Why the last exchange of the plan with a file did not happen; shown in the toolbar. */
export type SitePlanFileIssue = 'import-failed' | 'export-failed';

/**
 * What the toolbar tells the user about the plan's copy in storage. `blocked`
 * means storage holds something this build could not read: autosave stays off
 * so the record is never written over, and the plan on screen lives in this
 * session only.
 */
export type SitePlanSaveState = 'saved' | 'saving' | 'error' | 'blocked';

/**
 * Autosave debounce. Long enough that a drag, a slider sweep or a typed number
 * reaches storage once, short enough that a closed tab loses nothing worth
 * missing.
 */
const AUTOSAVE_DELAY_MS = 500;

export interface IPlanPersistenceHost {
  readonly snapshot: SitePlan;
  /** A plan read from storage: applied as-is, no step to undo. */
  applySnapshot(plan: SitePlan): void;
  /** A plan read from a file: adopted as one step to undo. */
  replacePlan(plan: SitePlan): void;
}

/** The plan's life outside the session: storage, autosave and file exchange. */
export class PlanPersistence {
  saveState: SitePlanSaveState = 'saved';
  fileIssue: SitePlanFileIssue | undefined = undefined;

  private readonly host: IPlanPersistenceHost;
  private readonly repository: ISitePlanRepository;
  private disposeAutosave: IReactionDisposer | undefined = undefined;
  private saveRequestId = 0;
  private isDisposed = false;

  constructor(host: IPlanPersistenceHost, repository: ISitePlanRepository) {
    this.host = host;
    this.repository = repository;

    makeAutoObservable<
      PlanPersistence,
      'host' | 'repository' | 'disposeAutosave' | 'saveRequestId' | 'isDisposed'
    >(
      this,
      {
        host: false,
        repository: false,
        disposeAutosave: false,
        saveRequestId: false,
        isDisposed: false,
      },
      { autoBind: true }
    );
  }

  /**
   * Reads the persisted plan and only then starts watching for changes: a plan
   * loaded from storage is not an edit, and must not be written straight back.
   */
  async start(): Promise<void> {
    const loaded = await this.repository.loadPlan();

    // The route may already have been left while the read was in flight; a
    // reaction started now would outlive the store that owns it.
    if (this.isDisposed) {
      return;
    }

    runInAction(() => {
      switch (loaded.kind) {
        case 'loaded':
          this.host.applySnapshot(loaded.plan);
          this.watchForChanges();
          break;
        case 'empty':
          this.watchForChanges();
          break;
        case 'unreadable':
          this.saveState = 'blocked';
          break;
      }
    });
  }

  /** Reads a picked JSON file into the plan; anything unreadable is reported. */
  async importPlanFile(file: File): Promise<void> {
    this.fileIssue = undefined;

    try {
      const text = await file.text();

      runInAction(() => this.adoptSerializedPlan(text));
    } catch {
      runInAction(() => {
        this.fileIssue = 'import-failed';
      });
    }
  }

  /** The export could not produce a file — an image the browser refused to encode. */
  reportExportFailure(): void {
    this.fileIssue = 'export-failed';
  }

  dismissFileIssue(): void {
    this.fileIssue = undefined;
  }

  dispose(): void {
    this.isDisposed = true;
    this.disposeAutosave?.();
    this.disposeAutosave = undefined;
  }

  private watchForChanges(): void {
    this.disposeAutosave = reaction(
      () => this.host.snapshot,
      nextPlan => {
        void this.persistPlan(nextPlan);
      },
      { delay: AUTOSAVE_DELAY_MS }
    );
  }

  private async persistPlan(plan: SitePlan): Promise<void> {
    this.saveRequestId += 1;

    const requestId = this.saveRequestId;

    this.saveState = 'saving';

    try {
      await this.repository.savePlan(plan);
      this.settleSave(requestId, 'saved');
    } catch {
      this.settleSave(requestId, 'error');
    }
  }

  /** A save another one has already overtaken must not report its own outcome. */
  private settleSave(requestId: number, saveState: SitePlanSaveState): void {
    if (requestId === this.saveRequestId) {
      this.saveState = saveState;
    }
  }

  /** A file that is not a plan of this build leaves the current one untouched. */
  private adoptSerializedPlan(text: string): void {
    const plan = parseSnapshot(text);

    if (isNil(plan)) {
      this.fileIssue = 'import-failed';

      return;
    }

    this.host.replacePlan(plan);
  }
}
