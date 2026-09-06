import type { DBSchema, IDBPDatabase } from 'idb';
import { openDB } from 'idb';
import { isNil } from 'lodash-es';

import type { SitePlan } from '../domain/model/site-plan';
import { parseSnapshot, serializeSitePlan } from '../domain/model/snapshot';
import type {
  ISitePlanRepository,
  PlanLoadResult,
} from '../domain/persistence/ISitePlanRepository';

const DATABASE_NAME = 'site-planner';
const DATABASE_VERSION = 1;
const PLANS_STORE = 'site-plans';
/** A1 — one site, one document: the record always lives under this key. */
const CURRENT_PLAN_KEY = 'current';

interface SitePlannerDbSchema extends DBSchema {
  [PLANS_STORE]: {
    key: string;
    /** The serialised snapshot, so the versioned format is what reaches the disk. */
    value: string;
  };
}

/**
 * Persists the plan as one serialised snapshot in IndexedDB. The store keeps
 * strings rather than plain objects on purpose: the snapshot module owns the
 * document format and its validation, so a record written by another build is
 * rejected by the very same parser the rest of the app uses.
 */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createIndexedDBSitePlanRepository(
  databaseName: string = DATABASE_NAME
): ISitePlanRepository {
  let databasePromise: Promise<IDBPDatabase<SitePlannerDbSchema>> | undefined;

  const openDatabase = (): Promise<IDBPDatabase<SitePlannerDbSchema>> => {
    if (isNil(databasePromise)) {
      const opening = openDB<SitePlannerDbSchema>(databaseName, DATABASE_VERSION, {
        upgrade(upgrading) {
          if (!upgrading.objectStoreNames.contains(PLANS_STORE)) {
            upgrading.createObjectStore(PLANS_STORE);
          }
        },
      });

      // A failed open must not be remembered: every later save would inherit the
      // rejection of a failure that may well have been transient.
      opening.catch(() => {
        if (databasePromise === opening) {
          databasePromise = undefined;
        }
      });

      databasePromise = opening;
    }

    return databasePromise;
  };

  return {
    async loadPlan(): Promise<PlanLoadResult> {
      let raw: string | undefined;

      try {
        const database = await openDatabase();

        raw = await database.get(PLANS_STORE, CURRENT_PLAN_KEY);
      } catch (error) {
        return { kind: 'unreadable', reason: describeError(error) };
      }

      if (isNil(raw)) {
        return { kind: 'empty' };
      }

      const plan = parseSnapshot(raw);

      return isNil(plan)
        ? { kind: 'unreadable', reason: 'the stored record is not a plan this build can read' }
        : { kind: 'loaded', plan };
    },

    async savePlan(plan: SitePlan): Promise<void> {
      const database = await openDatabase();

      await database.put(PLANS_STORE, serializeSitePlan(plan), CURRENT_PLAN_KEY);
    },
  };
}
