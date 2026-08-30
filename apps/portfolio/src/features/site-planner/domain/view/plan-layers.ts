/**
 * Which parts of the plan a sheet shows. This is a way of looking at the plan
 * rather than part of it — hiding the grid before an export must not change the
 * document — so the set is editor state and never reaches a snapshot.
 *
 * One layer composes with a control the plan already has: `analysis` filters
 * whatever the overlay segment is colouring — the toolbar decides *which*
 * analysis exists at all, this set decides whether the sheet shows it.
 */
export type PlanLayerKind =
  | 'grid'
  | 'contours'
  | 'marks'
  | 'dimensions'
  | 'setback'
  | 'analysis'
  | 'trees'
  | 'paths';

/** Every layer, in the order the settings panel lists them. */
export const PLAN_LAYER_KINDS: readonly PlanLayerKind[] = [
  'grid',
  'contours',
  'setback',
  'dimensions',
  'analysis',
  'marks',
  'trees',
  'paths',
];

/** A plan opens showing everything it has. */
export const ALL_PLAN_LAYERS: ReadonlySet<PlanLayerKind> = new Set(PLAN_LAYER_KINDS);

export function togglePlanLayer(
  layers: ReadonlySet<PlanLayerKind>,
  layer: PlanLayerKind
): ReadonlySet<PlanLayerKind> {
  const next = new Set(layers);

  if (next.has(layer)) {
    next.delete(layer);
  } else {
    next.add(layer);
  }

  return next;
}
