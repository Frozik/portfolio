import type { ISO, TDatabaseErrorCallback } from '@frozik/utils';
import {
  createDatabase$,
  createDB,
  databaseReconnect,
  EDatabaseErrorCallbackType,
  getDatabaseVersion,
  receiveFromTabs,
  sendToTabs,
  shareReplayWithDelayedReset,
} from '@frozik/utils';
import type { DBSchema, IDBPDatabase } from 'idb';
import { isNil, orderBy, sortBy } from 'lodash-es';
import type { Observable } from 'rxjs';
import { firstValueFrom, from, merge, of, Subject } from 'rxjs';
import { map, switchMap, take, tap } from 'rxjs/operators';

import { SHARE_RESET_DELAY } from '../../../app/constants';
import type { IGeneration } from '../domain/defs';

enum ERobotType {
  TensorFlow = 'TensorFlow',
}

interface IDBRobot {
  readonly type: ERobotType.TensorFlow;
  readonly name: string;
  readonly modelUrl: string;
  readonly score: number;
}

interface IDBGeneration {
  readonly competitionStart: ISO;
  readonly id: number;
  readonly maxScore: number;
  robotNames: string[];
}

const CURRENT_DATABASE_VERSION = 1;
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

const DATABASE_CHANNEL_SYNC_KEY = '__DB-COMPETITIONS-SYNC';

interface IDBCompetitions extends DBSchema {
  [ROBOTS_TABLE_NAME]: {
    value: IDBRobot;
    key: string;
    indexes: {
      [ROBOT_NAME_INDEX]: string;
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

export async function createIndexDBGenerationsModule(): Promise<TModuleIndexDBGenerations> {
  const databaseChanged$ = new Subject<void>();

  const database$ = createDatabase$<IDBCompetitions>(createGenerationDB).pipe(
    databaseReconnect(),
    switchMap(database => {
      return merge(
        of(database),
        receiveFromTabs<void>(DATABASE_CHANNEL_SYNC_KEY).pipe(map(() => database)),
        databaseChanged$.pipe(map(() => database))
      );
    }),
    shareReplayWithDelayedReset(SHARE_RESET_DELAY)
  );

  return {
    getCompetitionsStarts$(): Observable<ISO[]> {
      return database$.pipe(
        switchMap(database => {
          return from(getCompetitions(database));
        })
      );
    },
    getGenerations$(competitionStart: ISO): Observable<IGeneration[]> {
      return database$.pipe(
        switchMap(database => {
          return from(getGenerations(database, competitionStart));
        })
      );
    },
    addGeneration$(competitionStart: ISO, generation: IGeneration): Promise<void> {
      return firstValueFrom(
        database$.pipe(
          switchMap(database => {
            return addGeneration(database, competitionStart, generation);
          }),
          sendToTabs(DATABASE_CHANNEL_SYNC_KEY),
          tap(() => {
            databaseChanged$.next();
          })
        )
      );
    },
    getRobot$(robotName: string) {
      return database$.pipe(
        switchMap(database => {
          return from(getRobot(database, robotName));
        }),
        take(1)
      );
    },
  };
}

export interface TModuleIndexDBGenerations {
  getCompetitionsStarts$(): Observable<ISO[]>;
  getGenerations$(competitionStart: ISO): Observable<IGeneration[]>;
  addGeneration$(competitionStart: ISO, generation: IGeneration): Promise<void>;
  getRobot$(
    robotName: string
  ): Observable<
    { readonly name: string; readonly modelUrl: string; readonly score: number } | undefined
  >;
}

export async function createGenerationDB(
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
    upgrade(database: IDBPDatabase<IDBCompetitions>, oldVersion: number) {
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

        robotsStore.createIndex(ROBOT_NAME_INDEX, ROBOT_NAME_FIELD);
        robotsStore.createIndex(ROBOT_SCORE_INDEX, ROBOT_SCORE_FIELD);
      }
    },
  });
}

async function getCompetitions(database: IDBPDatabase<IDBCompetitions>): Promise<ISO[]> {
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
): Promise<IGeneration[]> {
  const generationsTransaction = database.transaction(GENERATIONS_TABLE_NAME, 'readonly');

  const competitionStartIndex = generationsTransaction
    .objectStore(GENERATIONS_TABLE_NAME)
    .index(GENERATION_COMPETITION_START_INDEX);
  const generations = await competitionStartIndex.getAll(competitionStart);
  const orderedGenerations = orderBy(generations, GENERATION_ID_FIELD);

  const robotsTransaction = database.transaction(ROBOTS_TABLE_NAME, 'readonly');

  const robotNamesSet = new Set<string>();

  for (const { robotNames } of orderedGenerations) {
    for (const robotName of robotNames) {
      robotNamesSet.add(robotName);
    }
  }

  const robotsMap = new Map<string, IDBRobot>();

  for (const robotName of robotNamesSet) {
    const robot = await robotsTransaction.objectStore(ROBOTS_TABLE_NAME).get(robotName);

    if (isNil(robot)) {
      throw new Error(`Robot "${robotName}" is not found`);
    }

    robotsMap.set(robotName, robot);
  }

  return orderedGenerations.map(({ robotNames, id, maxScore }) => ({
    id,
    maxScore,
    players: sortBy(
      robotNames.map(robotName => {
        const robot = robotsMap.get(robotName) as IDBRobot;

        return {
          name: robot.name,
          modelUrl: robot.modelUrl,
          score: robot.score,
        };
      }),
      ({ score }) => -score
    ),
  }));
}

function getRobot(
  database: IDBPDatabase<IDBCompetitions>,
  robotName: string
): Promise<
  { readonly name: string; readonly modelUrl: string; readonly score: number } | undefined
> {
  return database
    .transaction(ROBOTS_TABLE_NAME, 'readonly')
    .objectStore(ROBOTS_TABLE_NAME)
    .get(robotName);
}

async function addGeneration(
  database: IDBPDatabase<IDBCompetitions>,
  competitionStart: ISO,
  generation: IGeneration
): Promise<void> {
  for (const player of generation.players) {
    const robot = await database.get(ROBOTS_TABLE_NAME, player.name);

    await database.put(ROBOTS_TABLE_NAME, {
      type: ERobotType.TensorFlow,
      name: player.name,
      modelUrl: player.modelUrl,
      score: isNil(robot) ? player.score : Math.max(robot.score, player.score),
    });
  }

  await database.put(GENERATIONS_TABLE_NAME, {
    competitionStart,
    id: generation.id,
    maxScore: generation.maxScore,
    robotNames: generation.players.map(({ name }) => name),
  });
}
