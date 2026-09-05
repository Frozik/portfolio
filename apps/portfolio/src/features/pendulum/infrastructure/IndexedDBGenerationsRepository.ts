import { assert } from '@frozik/utils/assert/assert';
import { createDB, getDatabaseVersion } from '@frozik/utils/database';
import type { ISO, Milliseconds } from '@frozik/utils/date/types';
import type { TDatabaseErrorCallback } from '@frozik/utils/rx/database';
import {
  createDatabase$,
  databaseReconnect,
  EDatabaseErrorCallbackType,
} from '@frozik/utils/rx/database';
import { shareReplayWithDelayedReset } from '@frozik/utils/rx/shareReplayWithDelayedReset';
import type { DBSchema, IDBPDatabase } from 'idb';
import { isNil, orderBy, sortBy } from 'lodash-es';
import type { Observable } from 'rxjs';
import { firstValueFrom, from, merge, of, Subject } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import type { IGeneration } from '../domain/generation';
import type {
  IGenerationsRepository,
  IRepositoryObserver,
  IRobotRecord,
} from '../domain/ports/generations-repository';
import type { IRobotPlayer, RobotModelUrl } from '../domain/types';

enum ERobotType {
  TensorFlow = 'TensorFlow',
}

interface IDBRobot {
  readonly type: ERobotType.TensorFlow;
  readonly name: string;
  readonly modelUrl: RobotModelUrl;
  readonly score: number;
}

interface IDBGeneration {
  readonly competitionStart: ISO;
  readonly id: number;
  readonly maxScore: number;
  readonly robotNames: readonly string[];
}

const CURRENT_DATABASE_VERSION = 2;
const DATABASE_NAME = 'competitions';

const ROBOTS_TABLE_NAME = 'robots';
const GENERATIONS_TABLE_NAME = 'generations';

const GENERATION_COMPETITION_START_INDEX = 'by-competition-start';
const GENERATION_ID_INDEX = 'by-id';
const GENERATION_COMPETITION_START_FIELD: keyof IDBGeneration = 'competitionStart';
const GENERATION_ID_FIELD: keyof IDBGeneration = 'id';

const ROBOT_NAME_INDEX = 'by-name';
const ROBOT_SCORE_INDEX = 'by-score';
const ROBOT_NAME_FIELD: keyof IDBRobot = 'name';
const ROBOT_SCORE_FIELD: keyof IDBRobot = 'score';

const REMOVE_REDUNDANT_NAME_INDEX_VERSION = 2;

const DATABASE_SHARE_RESET_DELAY = 30_000 as Milliseconds;

// tf.js resolves this scheme to its own IndexedDB store; the robot record keeps
// the very same URL so the model is reloaded from where it was saved.
const ROBOT_MODEL_URL_SCHEME = 'indexeddb://';

function buildRobotModelUrl(competitionStart: ISO, robotName: string): RobotModelUrl {
  return `${ROBOT_MODEL_URL_SCHEME}${competitionStart}-player-${robotName}` as RobotModelUrl;
}

interface IDBCompetitions extends DBSchema {
  [ROBOTS_TABLE_NAME]: {
    value: IDBRobot;
    key: string;
    indexes: {
      [ROBOT_SCORE_INDEX]: number;
    };
  };
  [GENERATIONS_TABLE_NAME]: {
    value: IDBGeneration;
    key: [ISO, number];
    indexes: {
      [GENERATION_COMPETITION_START_INDEX]: ISO;
      [GENERATION_ID_INDEX]: number;
    };
  };
}

export function createIndexedDbGenerationsRepository(): IGenerationsRepository {
  // Two independent invalidation signals, deliberately NOT merged:
  // - `competitionsChanged$` refreshes the competitions LIST (a brand-new
  //   competition's first generation must make its start appear; a delete must
  //   remove it).
  // - `generationsChanged$` refreshes the generations of the open competition.
  //
  // `addGeneration$` only pings `competitionsChanged$`. It must NOT trigger a
  // full generations re-read: the originating tab already appended the row
  // optimistically (PendulumStore.addCompetitionRun), so re-reading every
  // generation from IndexedDB on each persisted generation is pure redundant
  // work. Cross-tab sync was removed with the dockable layout, so there is no
  // other tab to refresh here either.
  const competitionsChanged$ = new Subject<void>();
  const generationsChanged$ = new Subject<void>();

  const database$ = createDatabase$<IDBCompetitions>(createGenerationDB).pipe(
    databaseReconnect(),
    shareReplayWithDelayedReset(DATABASE_SHARE_RESET_DELAY)
  );

  const withDatabase = <TResult>(
    read: (database: IDBPDatabase<IDBCompetitions>) => Promise<TResult>
  ): Promise<TResult> => firstValueFrom(database$.pipe(switchMap(read)));

  const watch = <TValue>(
    changed$: Observable<void>,
    read: (database: IDBPDatabase<IDBCompetitions>) => Promise<TValue>,
    observer: IRepositoryObserver<TValue>
  ): VoidFunction => {
    const subscription = database$
      .pipe(
        switchMap(database => merge(of(database), changed$.pipe(map(() => database)))),
        switchMap(database => from(read(database)))
      )
      .subscribe(observer);
    return () => subscription.unsubscribe();
  };

  return {
    watchCompetitionStarts(observer) {
      return watch(competitionsChanged$, getCompetitions, observer);
    },
    watchGenerations(competitionStart, observer) {
      return watch(
        generationsChanged$,
        database => getGenerations(database, competitionStart),
        observer
      );
    },
    async addGeneration(competitionStart, generation) {
      await withDatabase(database => addGeneration(database, competitionStart, generation));
      // Only the list needs to react: the open competition's generations are
      // kept current optimistically by the caller.
      competitionsChanged$.next();
    },
    async deleteCompetition(competitionStart) {
      await withDatabase(database => deleteCompetition(database, competitionStart));
      competitionsChanged$.next();
      generationsChanged$.next();
    },
    findRobot(robotName) {
      return withDatabase(database => getRobot(database, robotName));
    },
    async saveRobotModel(competitionStart, robot: IRobotPlayer) {
      const modelUrl = buildRobotModelUrl(competitionStart, robot.name);
      await robot.save(modelUrl);
      return modelUrl;
    },
  };
}

async function createGenerationDB(
  dbCallback: TDatabaseErrorCallback
): Promise<IDBPDatabase<IDBCompetitions>> {
  const currentVersion = (await getDatabaseVersion(DATABASE_NAME)) ?? 0;
  const requestedVersion = Math.max(currentVersion, CURRENT_DATABASE_VERSION);

  return createDB<IDBCompetitions>(DATABASE_NAME, requestedVersion, {
    async blocked() {
      await dbCallback(EDatabaseErrorCallbackType.Blocked);
    },
    async blocking() {
      await dbCallback(EDatabaseErrorCallbackType.Blocking);
    },
    async terminated() {
      await dbCallback(EDatabaseErrorCallbackType.Terminated);
    },
    upgrade(
      database: IDBPDatabase<IDBCompetitions>,
      oldVersion: number,
      _newVersion: number | null,
      transaction
    ) {
      if (oldVersion < 1) {
        const generationsStore = database.createObjectStore(GENERATIONS_TABLE_NAME, {
          keyPath: [GENERATION_COMPETITION_START_FIELD, GENERATION_ID_FIELD],
        });

        generationsStore.createIndex(
          GENERATION_COMPETITION_START_INDEX,
          GENERATION_COMPETITION_START_FIELD
        );
        generationsStore.createIndex(GENERATION_ID_INDEX, GENERATION_ID_FIELD);

        const robotsStore = database.createObjectStore(ROBOTS_TABLE_NAME, {
          keyPath: ROBOT_NAME_FIELD,
        });

        robotsStore.createIndex(ROBOT_SCORE_INDEX, ROBOT_SCORE_FIELD);
      }

      if (oldVersion > 0 && oldVersion < REMOVE_REDUNDANT_NAME_INDEX_VERSION) {
        // The `by-name` index duplicated the robots store's `name` keyPath, so
        // lookups already go through the primary key. Drop the dead index.
        transaction.objectStore(ROBOTS_TABLE_NAME).deleteIndex(ROBOT_NAME_INDEX);
      }
    },
  });
}

async function getCompetitions(database: IDBPDatabase<IDBCompetitions>): Promise<readonly ISO[]> {
  const transaction = database.transaction(GENERATIONS_TABLE_NAME, 'readonly');
  const competitionIdIndex = transaction
    .objectStore(GENERATIONS_TABLE_NAME)
    .index(GENERATION_COMPETITION_START_INDEX);

  // Workaround for Safari https://github.com/dexie/Dexie.js/issues/1052
  if ((await competitionIdIndex.count()) === 0) {
    return [];
  }

  let cursor = await competitionIdIndex.openCursor(null, 'prevunique');

  const competitionsStarts: ISO[] = [];

  while (!isNil(cursor)) {
    competitionsStarts.push(cursor.key as ISO);
    cursor = await cursor.continue();
  }

  return competitionsStarts;
}

async function getGenerations(
  database: IDBPDatabase<IDBCompetitions>,
  competitionStart: ISO
): Promise<readonly IGeneration[]> {
  // Single readonly transaction over both stores — generations and their
  // robots come from one consistent snapshot (two separate transactions could
  // straddle a concurrent write/delete and observe a generation without its
  // robots).
  const transaction = database.transaction([GENERATIONS_TABLE_NAME, ROBOTS_TABLE_NAME], 'readonly');

  const competitionStartIndex = transaction
    .objectStore(GENERATIONS_TABLE_NAME)
    .index(GENERATION_COMPETITION_START_INDEX);
  const generations = await competitionStartIndex.getAll(competitionStart);
  const orderedGenerations = orderBy(generations, GENERATION_ID_FIELD);

  const robotsStore = transaction.objectStore(ROBOTS_TABLE_NAME);

  const robotNamesSet = new Set<string>();

  for (const { robotNames } of orderedGenerations) {
    for (const robotName of robotNames) {
      robotNamesSet.add(robotName);
    }
  }

  const robotNames = Array.from(robotNamesSet);
  const robotRecords = await Promise.all(robotNames.map(robotName => robotsStore.get(robotName)));

  const robotsMap = new Map<string, IDBRobot>();

  robotNames.forEach((robotName, index) => {
    const robot = robotRecords[index];
    if (isNil(robot)) {
      throw new Error(`Robot "${robotName}" is not found`);
    }
    robotsMap.set(robotName, robot);
  });

  const readRobot = (robotName: string): IRobotRecord => {
    const robot = robotsMap.get(robotName);
    assert(!isNil(robot), `Robot "${robotName}" was loaded with its generation`);
    return { name: robot.name, modelUrl: robot.modelUrl, score: robot.score };
  };

  return orderedGenerations.map(({ robotNames, id, maxScore }) => ({
    id,
    maxScore,
    players: sortBy(robotNames.map(readRobot), ({ score }) => -score),
  }));
}

async function getRobot(
  database: IDBPDatabase<IDBCompetitions>,
  robotName: string
): Promise<IRobotRecord | undefined> {
  const robot = await database
    .transaction(ROBOTS_TABLE_NAME, 'readonly')
    .objectStore(ROBOTS_TABLE_NAME)
    .get(robotName);

  return isNil(robot)
    ? undefined
    : { name: robot.name, modelUrl: robot.modelUrl, score: robot.score };
}

async function deleteCompetition(
  database: IDBPDatabase<IDBCompetitions>,
  competitionStart: ISO
): Promise<void> {
  const transaction = database.transaction(
    [GENERATIONS_TABLE_NAME, ROBOTS_TABLE_NAME],
    'readwrite'
  );
  const generationsStore = transaction.objectStore(GENERATIONS_TABLE_NAME);
  const robotsStore = transaction.objectStore(ROBOTS_TABLE_NAME);

  // Robot names are unique to a competition lineage: a continued competition
  // reloads its own players by name, while mutated/crossover/new players always
  // get fresh ids. No robot referenced by this competition is referenced by
  // another, so deleting its robots needs no whole-store cross-reference scan —
  // we walk only this competition's generations via the keyed index.
  const referencedRobotNames = new Set<string>();

  let generationCursor = await generationsStore
    .index(GENERATION_COMPETITION_START_INDEX)
    .openCursor(competitionStart);

  while (!isNil(generationCursor)) {
    for (const robotName of generationCursor.value.robotNames) {
      referencedRobotNames.add(robotName);
    }
    await generationCursor.delete();
    generationCursor = await generationCursor.continue();
  }

  await Promise.all(
    Array.from(referencedRobotNames).map(robotName => robotsStore.delete(robotName))
  );

  await transaction.done;
}

async function addGeneration(
  database: IDBPDatabase<IDBCompetitions>,
  competitionStart: ISO,
  generation: IGeneration
): Promise<void> {
  // ONE readwrite transaction over both stores. This is load-bearing twice:
  // 1) atomicity — readers can never observe a generation whose robots are
  //    only partially written;
  // 2) ordering — IndexedDB serializes overlapping readwrite transactions in
  //    creation order, so concurrent addGeneration calls (the training loop
  //    does not await persistence) commit in generation order. With the old
  //    per-operation auto-commit transactions generation N+1 could land
  //    BEFORE generation N, and the full re-read triggered by databaseChanged$
  //    briefly rendered a list with a hole in the middle.
  const transaction = database.transaction(
    [ROBOTS_TABLE_NAME, GENERATIONS_TABLE_NAME],
    'readwrite'
  );
  const robotsStore = transaction.objectStore(ROBOTS_TABLE_NAME);
  const generationsStore = transaction.objectStore(GENERATIONS_TABLE_NAME);

  await Promise.all([
    ...generation.players.map(async player => {
      const robot = await robotsStore.get(player.name);
      await robotsStore.put({
        type: ERobotType.TensorFlow,
        name: player.name,
        modelUrl: player.modelUrl,
        score: isNil(robot) ? player.score : Math.max(robot.score, player.score),
      });
    }),
    generationsStore.put({
      competitionStart,
      id: generation.id,
      maxScore: generation.maxScore,
      robotNames: generation.players.map(({ name }) => name),
    }),
  ]);

  await transaction.done;
}
