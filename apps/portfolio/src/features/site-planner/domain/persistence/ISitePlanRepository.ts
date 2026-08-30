import type { SitePlan } from '../model/site-plan';

/**
 * Where the one site plan of this editor lives between sessions (A1: a single
 * document, not a project manager).
 *
 * `loadPlan` never rejects: a missing record, a record this build cannot read
 * and a storage that will not open are the same situation to the editor — it
 * opens the default plan instead of refusing to open at all. `savePlan` does
 * reject, because a failed save is something the user has to be told about.
 */
export interface ISitePlanRepository {
  loadPlan(): Promise<SitePlan | undefined>;
  savePlan(plan: SitePlan): Promise<void>;
}
