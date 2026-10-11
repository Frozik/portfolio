import type { IStorageProvider } from '@frozik/cloud-storage/core/storage-provider';
import { createMemoryProvider } from '@frozik/cloud-storage/memory/memory-provider';
import type { Milliseconds } from '@frozik/utils/date/types';
import * as fc from 'fast-check';
import { isEqual } from 'lodash-es';

import { ARGON2_DEFAULT } from '../crypto/kdf-port';
import { createVaultKeys } from '../format/vault-keys';
import { allFields } from '../model/card';
import {
  createCard,
  editCard,
  putCard,
  renameCard,
  setFavorite,
  trashCard,
} from '../model/card-edits';
import { setFieldValue } from '../model/field-edits';
import { HISTORY_THROTTLE_MS } from '../model/revision-edits';
import { INTERNET_ACCOUNT_TEMPLATE } from '../model/templates/internet-account';
import type { IVaultDocument } from '../model/vault-document';
import { emptyVaultDocument } from '../model/vault-document';
import { createFakeKdf } from '../testing/fake-kdf';
import { createSeededRandom } from '../testing/seeded-random';
import { createRacyProvider, SyncSimulation } from '../testing/sync-simulation';
import type { ISimTab } from '../testing/sync-simulation';
import { aManifest, TEST_PASSWORD } from '../testing/vault-file-fixtures';

const DEVICES = 3;
const TABS = 2;
const STEPS = 160;
const MAX_EDITS = 18;
const QUIET_ROUNDS = 30;
const EFFECTS_PER_ROUND = 5000;
const SPACING = HISTORY_THROTTLE_MS * 2;
/** Waits for the simulation to finish, it does not time it: about half a second locally, slow CI runners get room. */
const SIMULATION_TIMEOUT_MS = 60_000;

const pick = <T>(
  random: ReturnType<typeof createSeededRandom>,
  items: readonly T[]
): T | undefined => items[(random.bytes(1)[0] ?? 0) % Math.max(1, items.length)];

/** Every title and field value the document still holds, current or in history: where an edit's marker must be. */
function textsOf(document: IVaultDocument): ReadonlySet<string> {
  const versions = [...document.cards.values()].flatMap(card => [
    card,
    ...card.history.map(revision => revision.snapshot),
  ]);
  return new Set(
    versions.flatMap(version => [
      version.title,
      ...allFields(version).flatMap(field =>
        field.value.cardinality === 'single' ? [field.value.value] : field.value.values
      ),
    ])
  );
}

async function simulate(
  seed: number,
  cloudOf: (random: ReturnType<typeof createSeededRandom>) => IStorageProvider
): Promise<void> {
  const random = createSeededRandom(seed);
  const dependencies = { argon2: createFakeKdf(), random, elapsed: () => 0 as Milliseconds };
  const keys = await createVaultKeys(TEST_PASSWORD, ARGON2_DEFAULT, dependencies);
  const start = emptyVaultDocument('Shared', { wallMs: 0, counter: 0, node: 'creator' });
  const simulation = new SyncSimulation(cloudOf(random), keys, aManifest(), random, dependencies);
  for (let device = 0; device < DEVICES; device += 1) {
    simulation.addDevice(`device-${device}`, TABS, start);
  }
  const markers: string[] = [];
  let now = 0;

  const editSomewhere = (tab: ISimTab): void => {
    now += SPACING;
    const marker = `edit-${markers.length}`;
    markers.push(marker);
    const existing = pick(random, [...tab.document.cards.keys()]);
    const roll = (random.bytes(1)[0] ?? 0) % 4;
    simulation.edit(tab, now, (document, at) => {
      if (roll === 0 || existing === undefined) {
        const card = createCard(INTERNET_ACCOUNT_TEMPLATE, { translate: key => key, random }, at);
        return putCard(document, { ...card, ...renameCard(card, marker) });
      }
      return editCard(document, existing, at, card => {
        switch (roll) {
          case 1:
            return renameCard(card, marker);
          case 2: {
            const password = allFields(card).find(field => field.spec.kind === 'password');
            return password === undefined
              ? renameCard(card, marker)
              : setFieldValue(card, password.id, { cardinality: 'single', value: marker });
          }
          default:
            return trashCard(setFavorite(renameCard(card, marker), !card.favorite), at);
        }
      });
    });
  };

  for (let step = 0; step < STEPS; step += 1) {
    const action = (random.bytes(1)[0] ?? 0) % 20;
    const tab = pick(random, simulation.tabs);
    if (tab === undefined) {
      continue;
    }
    if (action < 3 && markers.length < MAX_EDITS) {
      editSomewhere(tab);
    } else if (action === 3) {
      simulation.dispatch(tab, pick(random, ['local', 'cloud'] as const) ?? 'local', {
        kind: 'pull-requested',
      });
    } else if (action === 4) {
      tab.device.offline = !tab.device.offline;
      if (!tab.device.offline) {
        simulation.dispatch(tab.device.tabs[0] ?? tab, 'cloud', { kind: 'online' });
      }
    } else {
      await simulation.runOne();
    }
  }

  for (const device of simulation.devices) {
    device.offline = false;
  }
  let stableRounds = 0;
  for (let round = 0; round < QUIET_ROUNDS && stableRounds < 2; round += 1) {
    const before = simulation.tabs.map(tab => tab.document);
    for (const tab of simulation.tabs) {
      simulation.dispatch(tab, 'cloud', { kind: 'online' });
      simulation.dispatch(tab, 'cloud', { kind: 'pull-requested' });
      simulation.dispatch(tab, 'local', { kind: 'pull-requested' });
    }
    await simulation.runAll(EFFECTS_PER_ROUND);
    const after = simulation.tabs.map(tab => tab.document);
    const converged = after.every(document => isEqual(document, after[0]));
    stableRounds =
      converged && after.every((document, index) => isEqual(document, before[index]))
        ? stableRounds + 1
        : 0;
  }

  const [first, ...others] = simulation.tabs.map(tab => tab.document);
  expect(simulation.pendingCount).toBe(0);
  for (const document of others) {
    expect(document).toEqual(first);
  }
  const titles = first === undefined ? new Set<string>() : textsOf(first);
  expect(markers.length).toBeGreaterThan(0);
  expect(markers.filter(marker => !titles.has(marker))).toEqual([]);
  expect(await simulation.storedDocument('cloud')).toEqual(first);
  for (const device of simulation.devices) {
    expect(await simulation.storedDocument(device.local)).toEqual(first);
  }
}

/**
 * Devices × tabs editing, going offline and racing to write,
 * in an order the seed picks — renaming, changing a secret field, moving to the
 * trash. Afterwards every tab holds the same document and no edit is lost:
 * each marker is a title or a field value, current or in history.
 */
describe('sync model', () => {
  it(
    'converges without losing an edit on a provider with a real compare-and-swap',
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 1_000_000 }), seed =>
          simulate(seed, () => createMemoryProvider())
        ),
        { seed: 20261011, numRuns: 12 }
      );
    },
    SIMULATION_TIMEOUT_MS
  );

  it(
    'converges without losing an edit when the provider lets writes race, like Drive',
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 1_000_000 }), seed =>
          simulate(seed, random => createRacyProvider(random, 3))
        ),
        { seed: 20261011, numRuns: 12 }
      );
    },
    SIMULATION_TIMEOUT_MS
  );
});
