import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import type { Selection } from '../domain/model/selection';
import type { SiteSettingsChanges } from '../domain/model/settings-edits';
import { updateSettings as updateSettingsWith } from '../domain/model/settings-edits';
import type { SitePlan } from '../domain/model/site-plan';
import { utilityRoutesOf } from '../domain/model/site-plan';
import { lookupTimeZoneId } from '../infrastructure/timezone-lookup';
import type { PlanEditorCore } from './editor-core';
import type { PlanHistory } from './PlanHistory';
import type { ToolingModel } from './ToolingModel';

const NO_SELECTIONS: readonly Selection[] = [];

/**
 * The plan as one document: its snapshot, the settings section, adopting a
 * whole plan from storage or a file, undo and redo, and sweeping the plot
 * clean. Every section stays on the core; this is where they are read and
 * written together.
 */
export class PlanDocumentModel {
  private readonly core: PlanEditorCore;
  private readonly history: PlanHistory;
  private readonly tooling: ToolingModel;

  constructor(core: PlanEditorCore, history: PlanHistory, tooling: ToolingModel) {
    this.core = core;
    this.history = history;
    this.tooling = tooling;

    makeAutoObservable<PlanDocumentModel, 'core' | 'history' | 'tooling'>(
      this,
      { core: false, history: false, tooling: false },
      { autoBind: true }
    );
  }

  get snapshot(): SitePlan {
    return {
      boundary: this.core.boundary,
      elevationMarks: this.core.elevationMarks,
      buildings: this.core.buildings,
      trees: this.core.trees,
      cars: this.core.cars,
      paths: this.core.paths,
      utilityRoutes: this.core.utilityRoutes,
      settings: this.core.settings,
    };
  }

  /**
   * Edits the settings section. Fields typed digit by digit — a latitude, a
   * setback — pass their own `groupKey`, so a burst of keystrokes stays one step
   * to undo, the way the properties panel writes a dimension.
   */
  updateSettings(changes: SiteSettingsChanges, groupKey?: string): void {
    this.core.pushHistory(groupKey);
    this.core.settings = updateSettingsWith(this.core.settings, changes);
  }

  /**
   * Turns the plot's north (`domain/view/north-offset.ts`). Unlike every other
   * settings edit it announces no history step of its own: north is set both by
   * dragging the compass dial and by typing an azimuth, and each of those
   * announces the step it belongs to — the dial once, when the pointer goes
   * down, the way every other drag on the plan does.
   */
  setNorthOffsetDegrees(northOffsetDegrees: number): void {
    this.core.settings = updateSettingsWith(this.core.settings, {
      location: { northOffsetDegrees },
    });
  }

  /**
   * Adopts a whole plan read from a file, as one step to undo. Adopting a plan
   * discards whatever edit was announced before it, so the state this
   * replacement is undone to is armed afterwards rather than before.
   */
  replacePlan(plan: SitePlan): void {
    const previousPlan = this.snapshot;

    this.applySnapshot(plan);
    this.history.armPending(previousPlan);
    this.core.selections = NO_SELECTIONS;
    this.tooling.cancelDrafts();
  }

  applySnapshot(plan: SitePlan): void {
    this.core.boundary = plan.boundary;
    this.core.elevationMarks = plan.elevationMarks;
    this.core.buildings = plan.buildings;
    this.core.trees = plan.trees;
    this.core.cars = plan.cars;
    this.core.paths = plan.paths;
    this.core.utilityRoutes = utilityRoutesOf(plan);
    this.core.settings = plan.settings;

    // A plan that arrives whole — restored, or read from storage — discards the
    // state an announced edit was going to be undone to.
    this.history.discardPending();
  }

  undo(): void {
    this.restore(this.history.undo(this.snapshot));
  }

  redo(): void {
    this.restore(this.history.redo(this.snapshot));
  }

  /**
   * Sweeps the plot clean: every placed object — buildings, trees, cars,
   * paths, trenches — gone in ONE undo step. The plot itself survives: its
   * boundary, elevation marks and settings are the site, not objects on it.
   */
  clearSite(): void {
    this.core.exitEditMode();
    this.tooling.cancelDrafts();
    this.core.pushHistory();
    this.core.buildings = [];
    this.core.trees = [];
    this.core.cars = [];
    this.core.paths = [];
    this.core.utilityRoutes = [];
    this.core.selections = NO_SELECTIONS;
  }

  private restore(plan: SitePlan | undefined): void {
    if (isNil(plan)) {
      return;
    }

    this.applySnapshot(plan);
    // The selection survives — undoing a typed dimension must leave the shape
    // it was typed for in the properties panel. A selection the restored plan no
    // longer holds resolves to nothing through `selectedShape` anyway.
    this.tooling.cancelDrafts();
  }

  /** The IANA zone a picked point keeps, or nothing where the table is silent. */
  timeZoneIdAt(latitudeDegrees: number, longitudeDegrees: number): string | undefined {
    return lookupTimeZoneId(latitudeDegrees, longitudeDegrees);
  }

  /** Owns no timer or subscription; here so the store's teardown chain names every model. */
  dispose(): void {}
}
