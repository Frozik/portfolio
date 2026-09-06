import { createBuildingId } from './building';
import type { TreeSpecies } from './plot-objects';

import { isRecord, isPositiveNumber } from './snapshot-guards';

/** How a document written by an earlier version of the planner is brought up to the current shape before it is validated. */
export const CURRENT_SNAPSHOT_VERSION = 5;

/**
 * Snapshots written while a term could only hold a primitive. They name that
 * primitive `shape` where later versions name it `operand`, and they can hold no
 * groups at all, so migrating one is a rename over two flat term lists.
 */
const FLAT_TERM_SNAPSHOT_VERSION = 1;

/**
 * Snapshots written before the catalogue: they carry no cars, and their trees
 * name a family — `conifer` — where version 3 names the species standing for it.
 */
const PRE_CATALOG_SNAPSHOT_VERSION = 2;

/** How versions 1 and 2 named every tree drawn as a cone. */
const LEGACY_CONIFER_FAMILY = 'conifer';

/** The species that family becomes: the cone template is the spruce's. */
const LEGACY_CONIFER_SPECIES: TreeSpecies = 'spruce';

/**
 * Snapshots whose paths carry one width for the whole polyline. Version 4
 * moves the width into every point so a ribbon can vary along its run.
 */
const UNIFORM_PATH_WIDTH_SNAPSHOT_VERSION = 3;

/**
 * Snapshots with a single optional `house` where version 5 keeps a list of
 * named buildings. The migrated house becomes the list's only entry.
 */
const SINGLE_HOUSE_SNAPSHOT_VERSION = 4;

/** The name the migrated house wears; new buildings are named by the user. */
const MIGRATED_HOUSE_NAME = 'Дом';

/**
 * Brings a payload of any version this build knows up to the current one. The
 * older formats are migrated in a chain rather than each to the present: a
 * version 1 document is a version 2 one once its terms are renamed, so the step
 * that adds the catalogue only ever has to be written against version 2.
 */
export function migratePlan(plan: unknown, version: unknown): unknown {
  switch (version) {
    case CURRENT_SNAPSHOT_VERSION:
      return plan;
    case SINGLE_HOUSE_SNAPSHOT_VERSION:
      return migrateSingleHousePlan(plan);
    case UNIFORM_PATH_WIDTH_SNAPSHOT_VERSION:
      return migrateSingleHousePlan(migrateUniformPathWidthPlan(plan));
    case PRE_CATALOG_SNAPSHOT_VERSION:
      return migrateSingleHousePlan(migrateUniformPathWidthPlan(migratePreCatalogPlan(plan)));
    case FLAT_TERM_SNAPSHOT_VERSION:
      return migrateSingleHousePlan(
        migrateUniformPathWidthPlan(migratePreCatalogPlan(migrateFlatTermPlan(plan)))
      );
    default:
      return undefined;
  }
}

/**
 * Moves a version 4 plan's single optional house into the buildings list. It
 * runs before validation, so a plan that was never one is passed through
 * untouched for the validator to refuse.
 */
function migrateSingleHousePlan(plan: unknown): unknown {
  if (!isRecord(plan)) {
    return undefined;
  }

  const { house, ...rest } = plan;

  return {
    ...rest,
    buildings: isRecord(house)
      ? [{ ...house, id: createBuildingId(), name: MIGRATED_HOUSE_NAME }]
      : [],
  };
}

/**
 * Moves a version 3 path's single width into each of its points. It runs
 * before validation, so a path that was never one is passed through untouched
 * for the validator to refuse.
 */
function migrateUniformPathWidthPlan(plan: unknown): unknown {
  if (!isRecord(plan)) {
    return undefined;
  }

  const { paths } = plan;

  return { ...plan, paths: Array.isArray(paths) ? paths.map(migrateUniformPathWidthPath) : paths };
}

function migrateUniformPathWidthPath(path: unknown): unknown {
  if (!isRecord(path) || !Array.isArray(path.points) || !isPositiveNumber(path.width)) {
    return path;
  }

  const { width, points, ...rest } = path;

  return { ...rest, points: points.map(position => ({ position, width })) };
}

/**
 * Gives a pre-catalogue plan the sections and the species names version 3
 * expects: an empty car park, and the spruce that every tree drawn as a cone
 * used to be. It runs before validation, so a plan that was never one is passed
 * through untouched for the validator to refuse.
 */
function migratePreCatalogPlan(plan: unknown): unknown {
  if (!isRecord(plan)) {
    return undefined;
  }

  const { trees } = plan;

  return {
    ...plan,
    cars: [],
    trees: Array.isArray(trees) ? trees.map(migratePreCatalogTree) : trees,
  };
}

function migratePreCatalogTree(tree: unknown): unknown {
  if (!isRecord(tree) || tree.species !== LEGACY_CONIFER_FAMILY) {
    return tree;
  }

  return { ...tree, species: LEGACY_CONIFER_SPECIES };
}

/**
 * Renames `shape` to `operand` in both compositions of a version 1 plan. It runs
 * before validation, so every field it does not recognise is passed through
 * untouched for the validator to refuse.
 */
function migrateFlatTermPlan(plan: unknown): unknown {
  if (!isRecord(plan)) {
    return undefined;
  }

  const { house } = plan;

  return {
    ...plan,
    boundary: migrateFlatTermComposition(plan.boundary),
    house: isRecord(house)
      ? { ...house, composition: migrateFlatTermComposition(house.composition) }
      : house,
  };
}

function migrateFlatTermComposition(composition: unknown): unknown {
  if (!isRecord(composition) || !Array.isArray(composition.terms)) {
    return composition;
  }

  return { ...composition, terms: composition.terms.map(migrateFlatTerm) };
}

function migrateFlatTerm(term: unknown): unknown {
  if (!isRecord(term)) {
    return term;
  }

  const { shape, ...rest } = term;

  return { ...rest, operand: shape };
}
