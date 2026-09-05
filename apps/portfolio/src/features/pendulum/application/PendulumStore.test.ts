import type { ISO } from '@frozik/utils/date/types';
import { EValueDescriptorErrorCode } from '@frozik/utils/value-descriptors/codes';
import type { ValueDescriptor } from '@frozik/utils/value-descriptors/types';
import {
  isFailValueDescriptor,
  isSyncedValueDescriptor,
  isWaitingArgumentsValueDescriptor,
} from '@frozik/utils/value-descriptors/utils';
import type { Mock } from 'vitest';
import type { IGeneration } from '../domain/generation';
import { createFakeFrameScheduler } from '../domain/ports/fake-frame-scheduler.test-helper';
import type { IRobotPlayer, RobotModelUrl } from '../domain/types';
import { EPlayerType } from '../domain/types';
import { createFakeGenerationsRepository } from './fake-generations-repository.test-helper';

import { PendulumStore } from './PendulumStore';

const START = '2026-01-01T00:00:00.000Z' as ISO;

function generation(id: number): IGeneration {
  return {
    id,
    maxScore: id,
    players: [{ name: `robot-${id}`, modelUrl: `fake://${id}` as RobotModelUrl, score: id }],
  };
}

type TSpiedRobot = IRobotPlayer & { readonly dispose: Mock<() => undefined> };

function createRobot(name: string): TSpiedRobot {
  const robot: TSpiedRobot = {
    type: EPlayerType.Robot,
    name,
    play: () => ({ pivotVelocity: 0 }),
    mutate: async () => robot,
    crossoverModels: async () => robot,
    describeNetwork: () => [],
    save: async () => undefined,
    dispose: vi.fn(() => undefined),
  };
  return robot;
}

async function flushPromises(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0));
}

function setup() {
  const repository = createFakeGenerationsRepository();
  const keyStateSources: { readonly dispose: Mock<() => undefined> }[] = [];
  const robots = new Map<string, IRobotPlayer>();
  const store = new PendulumStore({
    repository,
    frames: createFakeFrameScheduler(),
    createKeyStateSource: () => {
      const source = { isPressed: () => false, dispose: vi.fn(() => undefined) };
      keyStateSources.push(source);
      return source;
    },
    loadRobot: async record => {
      const robot = robots.get(record.name);
      if (robot === undefined) {
        throw new Error(`no robot ${record.name}`);
      }
      return robot;
    },
  });
  return { repository, store, keyStateSources, robots };
}

function syncedValue<TValue>(descriptor: ValueDescriptor<TValue>, label: string): TValue {
  if (!isSyncedValueDescriptor(descriptor)) {
    throw new Error(`${label} is not synced`);
  }
  return descriptor.value;
}

describe('PendulumStore competitions', () => {
  it('lists the persisted competition starts', () => {
    const { repository, store } = setup();

    repository.emitCompetitionStarts([START]);

    expect(syncedValue(store.competitionsList, 'competitionsList')).toEqual([START]);
    store.dispose();
  });

  it('opens a new competition with no generations and starts the fitness run', () => {
    const { store } = setup();

    store.createCompetition();

    expect(syncedValue(store.generations, 'generations')).toEqual([]);
    expect(store.competition).toBeDefined();
    expect(store.fitness.paused).toBe(false);
    store.dispose();
  });

  it('builds the continued competition only once its generations arrived', () => {
    const { repository, store } = setup();

    store.loadCompetition(START);
    expect(store.competition).toBeUndefined();
    repository.emitGenerations(START, [generation(1), generation(2)]);

    expect(store.competition?.start).toBe(START);
    expect(syncedValue(store.generations, 'generations')).toHaveLength(2);
    store.dispose();
  });

  it('keeps the same competition when a later snapshot arrives', () => {
    const { repository, store } = setup();
    store.loadCompetition(START);
    repository.emitGenerations(START, [generation(1)]);
    const competition = store.competition;

    repository.emitGenerations(START, [generation(1), generation(2)]);

    expect(store.competition).toBe(competition);
    store.dispose();
  });

  it('shows the load failure instead of the generations', () => {
    const { repository, store } = setup();

    store.loadCompetition(START);
    repository.failGenerations(START, new Error('storage is gone'));

    expect(isFailValueDescriptor(store.generations)).toBe(true);
    store.dispose();
  });

  it('stops watching the previous competition when another one is opened', () => {
    const { repository, store } = setup();
    const other = '2026-02-01T00:00:00.000Z' as ISO;

    store.loadCompetition(START);
    store.loadCompetition(other);

    expect(repository.generationsWatchers(START)).toBe(0);
    expect(repository.generationsWatchers(other)).toBe(1);
    store.dispose();
  });

  it('returns to the competition picker and pauses when the open competition is deleted', async () => {
    const { store } = setup();
    store.createCompetition();
    const start = store.competition?.start;
    if (start === undefined) {
      throw new Error('competition was not created');
    }

    store.deleteCompetition(start);
    await flushPromises();

    expect(store.competition).toBeUndefined();
    expect(isWaitingArgumentsValueDescriptor(store.generations)).toBe(true);
    expect(store.fitness.paused).toBe(true);
    store.dispose();
  });

  it('leaves the open competition alone when another one is deleted', async () => {
    const { store } = setup();
    store.createCompetition();
    const competition = store.competition;

    store.deleteCompetition(START);
    await flushPromises();

    expect(store.competition).toBe(competition);
    store.dispose();
  });

  it('stops everything on dispose', () => {
    const { repository, store } = setup();
    store.loadCompetition(START);

    store.dispose();

    expect(repository.generationsWatchers(START)).toBe(0);
    expect(store.fitness.paused).toBe(true);
    expect(store.test.paused).toBe(true);
  });
});

describe('PendulumStore test player', () => {
  it('lets a human play while no robot is selected', () => {
    const { store, keyStateSources } = setup();

    expect(isWaitingArgumentsValueDescriptor(store.selectedRobot)).toBe(true);
    expect(keyStateSources).toHaveLength(1);
    store.dispose();
  });

  it('swaps the human for the selected robot and back', async () => {
    const { store, repository, robots, keyStateSources } = setup();
    const robot = createRobot('r1');
    robots.set('r1', robot);
    repository.robots.set('r1', { name: 'r1', modelUrl: 'fake://r1' as RobotModelUrl, score: 1 });

    store.selectRobot('r1');
    await flushPromises();
    expect(syncedValue(store.selectedRobot, 'selectedRobot')).toBe(robot);
    expect(keyStateSources[0].dispose).toHaveBeenCalledTimes(1);

    store.selectRobot(undefined);
    expect(robot.dispose).toHaveBeenCalledTimes(1);
    expect(keyStateSources).toHaveLength(2);
    store.dispose();
  });

  it('reports an unknown robot as not found', async () => {
    const { store } = setup();

    store.selectRobot('ghost');
    await flushPromises();

    expect(
      isFailValueDescriptor(store.selectedRobot) &&
        store.selectedRobot.fail.code === EValueDescriptorErrorCode.NOT_FOUND
    ).toBe(true);
    store.dispose();
  });

  it('drops a robot whose load finishes after another selection', async () => {
    const { store, repository, robots } = setup();
    const slow = createRobot('slow');
    const fast = createRobot('fast');
    robots.set('slow', slow);
    robots.set('fast', fast);
    repository.robots.set('slow', {
      name: 'slow',
      modelUrl: 'fake://s' as RobotModelUrl,
      score: 1,
    });
    repository.robots.set('fast', {
      name: 'fast',
      modelUrl: 'fake://f' as RobotModelUrl,
      score: 1,
    });

    store.selectRobot('slow');
    store.selectRobot('fast');
    await flushPromises();

    expect(syncedValue(store.selectedRobot, 'selectedRobot')).toBe(fast);
    expect(slow.dispose).toHaveBeenCalledTimes(1);
    store.dispose();
  });

  it('opens the network dialog for the picked robot', () => {
    const { store } = setup();

    store.openNeuralNetworkDialog('r1');

    expect(store.isNeuralNetworkDialogOpen).toBe(true);
    store.closeNeuralNetworkDialog();
    expect(store.isNeuralNetworkDialogOpen).toBe(false);
    store.dispose();
  });
});
