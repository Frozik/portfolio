import 'fake-indexeddb/auto';

import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';

import { createRectangle } from '../domain/model/shapes';
import type { SitePlan } from '../domain/model/site-plan';
import { createDefaultSitePlan } from '../domain/model/site-plan';
import { CURRENT_SNAPSHOT_VERSION, serializeSitePlan } from '../domain/model/snapshot';
import { createIndexedDBSitePlanRepository } from './IndexedDBSitePlanRepository';

const PLANS_STORE = 'site-plans';
const CURRENT_PLAN_KEY = 'current';
const DATABASE_VERSION = 1;

let databaseCounter = 0;

function uniqueDatabaseName(): string {
  databaseCounter += 1;

  return `site-planner-test-${databaseCounter}`;
}

/** Writes straight into the object store, bypassing the repository's own format. */
async function seedRecord(databaseName: string, record: unknown): Promise<void> {
  const database = await openDB(databaseName, DATABASE_VERSION, {
    upgrade(upgrading) {
      upgrading.createObjectStore(PLANS_STORE);
    },
  });

  await database.put(PLANS_STORE, record, CURRENT_PLAN_KEY);
  database.close();
}

function planWithTwoTerms(): SitePlan {
  const defaultPlan = createDefaultSitePlan();

  return {
    ...defaultPlan,
    boundary: {
      terms: [
        ...defaultPlan.boundary.terms,
        {
          operand: createRectangle({
            center: { x: 5, y: 5 },
            width: 4,
            length: 6,
            rotationDegrees: 30,
          }),
          operation: 'subtract',
        },
      ],
    },
  };
}

describe('IndexedDBSitePlanRepository', () => {
  it('reports an empty storage when nothing has been saved yet', async () => {
    const repository = createIndexedDBSitePlanRepository(uniqueDatabaseName());

    expect(await repository.loadPlan()).toEqual({ kind: 'empty' });
  });

  it('round-trips a saved plan', async () => {
    const repository = createIndexedDBSitePlanRepository(uniqueDatabaseName());
    const plan = planWithTwoTerms();

    await repository.savePlan(plan);

    expect(await repository.loadPlan()).toEqual({ kind: 'loaded', plan });
  });

  it('keeps a single document: the latest save replaces the previous one', async () => {
    const databaseName = uniqueDatabaseName();
    const repository = createIndexedDBSitePlanRepository(databaseName);

    await repository.savePlan(createDefaultSitePlan());
    await repository.savePlan(planWithTwoTerms());

    const database = await openDB(databaseName, DATABASE_VERSION);
    const recordCount = await database.count(PLANS_STORE);

    database.close();

    expect(recordCount).toBe(1);
    expect(await repository.loadPlan()).toMatchObject({ plan: { boundary: { terms: [{}, {}] } } });
  });

  it('reads back a plan written by another instance of the repository', async () => {
    const databaseName = uniqueDatabaseName();
    const plan = planWithTwoTerms();

    await createIndexedDBSitePlanRepository(databaseName).savePlan(plan);

    expect(await createIndexedDBSitePlanRepository(databaseName).loadPlan()).toEqual({
      kind: 'loaded',
      plan,
    });
  });

  it('refuses a record that is not valid JSON rather than passing it off as empty', async () => {
    const databaseName = uniqueDatabaseName();

    await seedRecord(databaseName, '{ this is not json');

    await expect(createIndexedDBSitePlanRepository(databaseName).loadPlan()).resolves.toMatchObject(
      { kind: 'unreadable' }
    );
  });

  it('refuses a record whose plan fails validation', async () => {
    const databaseName = uniqueDatabaseName();

    await seedRecord(
      databaseName,
      JSON.stringify({ version: CURRENT_SNAPSHOT_VERSION, plan: { boundary: 'not a composition' } })
    );

    await expect(createIndexedDBSitePlanRepository(databaseName).loadPlan()).resolves.toMatchObject(
      { kind: 'unreadable' }
    );
  });

  it('refuses a snapshot version this build does not know', async () => {
    const databaseName = uniqueDatabaseName();
    const fromTheFuture = serializeSitePlan(createDefaultSitePlan()).replace(
      `"version":${CURRENT_SNAPSHOT_VERSION}`,
      `"version":${CURRENT_SNAPSHOT_VERSION + 1}`
    );

    await seedRecord(databaseName, fromTheFuture);

    await expect(createIndexedDBSitePlanRepository(databaseName).loadPlan()).resolves.toMatchObject(
      { kind: 'unreadable' }
    );
  });

  it('saves over a broken record instead of leaving it in place', async () => {
    const databaseName = uniqueDatabaseName();

    await seedRecord(databaseName, 'broken');

    const repository = createIndexedDBSitePlanRepository(databaseName);
    const plan = planWithTwoTerms();

    await repository.savePlan(plan);

    expect(await repository.loadPlan()).toEqual({ kind: 'loaded', plan });
  });
});
