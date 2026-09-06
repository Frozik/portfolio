import type { SitePlan } from '../model/site-plan';

/**
 * What a read of the stored plan answers. `empty` is a first visit; `unreadable`
 * is a record this build cannot parse or a storage that will not open — the two
 * the editor must NOT write over, because whatever is there may be another
 * build's plan.
 */
export type PlanLoadResult =
  | { readonly kind: 'loaded'; readonly plan: SitePlan }
  | { readonly kind: 'empty' }
  | { readonly kind: 'unreadable'; readonly reason: string };

/**
 * Where the one site plan of this editor lives between sessions (A1: a single
 * document, not a project manager).
 *
 * `loadPlan` never rejects: it answers with what it found, or why it could not
 * read it, and the editor opens the default plan either way. `savePlan` does
 * reject, because a failed save is something the user has to be told about.
 */
export interface ISitePlanRepository {
  loadPlan(): Promise<PlanLoadResult>;
  savePlan(plan: SitePlan): Promise<void>;
}
