import { describe, expect, it } from 'vitest';

import type { IBestScoreStorage } from '../domain/ports/best-score-storage';
import type { IInputSource } from '../domain/ports/input-source';
import type { PlayerInputs, WorldEvent } from '../domain/types';
import { createTanksSession } from './tanks-session';
import { TanksStore } from './TanksStore';

function createBestScoreStorageStub(): IBestScoreStorage {
  return { read: () => 0, write: () => undefined };
}

function createKeyboard(inputs: PlayerInputs): IInputSource {
  return { read: () => inputs, dispose: () => undefined };
}

function createAudioSpy(): { readonly ticks: PlayerInputs[]; onTick(inputs: PlayerInputs): void } {
  const ticks: PlayerInputs[] = [];

  return { ticks, onTick: inputs => void ticks.push(inputs) };
}

function createPlayingStore(): TanksStore {
  const store = new TanksStore(createBestScoreStorageStub());

  store.startGame();
  store.skipStageIntro();

  return store;
}

describe('tanks session', () => {
  it('simulates only while the store says the game is playing', () => {
    const store = new TanksStore(createBestScoreStorageStub());
    const session = createTanksSession({
      store,
      audio: createAudioSpy(),
      keyboard: createKeyboard({ direction: undefined, fire: false }),
    });

    expect(session.isSimulating()).toBe(false);

    store.startGame();
    store.skipStageIntro();

    expect(session.isSimulating()).toBe(true);

    store.dispose();
  });

  it('lets effects finish during the stage-clear interlude', () => {
    const store = createPlayingStore();
    const session = createTanksSession({
      store,
      audio: createAudioSpy(),
      keyboard: createKeyboard({ direction: undefined, fire: false }),
    });

    store.applyWorldEvents([{ type: 'stage-cleared', stageNumber: 1 }]);

    expect(session.isSimulating()).toBe(false);
    expect(session.areEffectsRunning()).toBe(true);

    store.dispose();
  });

  it('merges the keyboard with the touch overlay into one set of inputs', () => {
    const store = createPlayingStore();
    const session = createTanksSession({
      store,
      audio: createAudioSpy(),
      keyboard: createKeyboard({ direction: 'left', fire: false }),
    });

    store.touchControls.setFire(true);

    expect(session.readInputs()).toEqual({ direction: 'left', fire: true });

    store.dispose();
  });

  it('hands each tick to the store and then to the audio', () => {
    const store = createPlayingStore();
    const audio = createAudioSpy();
    const session = createTanksSession({
      store,
      audio,
      keyboard: createKeyboard({ direction: undefined, fire: false }),
    });
    const inputs: PlayerInputs = { direction: 'up', fire: false };
    const events: readonly WorldEvent[] = [{ type: 'game-over' }];

    session.onTick(inputs, events);

    expect(store.gameStatus).toBe('game-over');
    expect(audio.ticks).toEqual([inputs]);

    store.dispose();
  });
});
