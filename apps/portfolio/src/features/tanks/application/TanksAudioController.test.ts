import type { IMutedStorage } from '@frozik/utils/storage/mutedStorage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IBestScoreStorage } from '../domain/ports/best-score-storage';
import type { PlayerInputs } from '../domain/types';
import type { EngineHumState } from '../infrastructure/audio/engine-hum';
import type { JingleId } from '../infrastructure/audio/jingles';
import type { SfxId } from '../infrastructure/audio/sfx-recipes';
import type { ITanksSoundEngine } from '../infrastructure/audio/sound-engine';
import { TanksAudioController } from './TanksAudioController';
import { TanksStore } from './TanksStore';

interface IEngineStub extends ITanksSoundEngine {
  readonly calls: string[];
  readonly playedSfx: SfxId[];
  readonly playedJingles: JingleId[];
  readonly humStates: EngineHumState[];
}

function createEngineStub(): IEngineStub {
  const calls: string[] = [];
  const playedSfx: SfxId[] = [];
  const playedJingles: JingleId[] = [];
  const humStates: EngineHumState[] = [];

  return {
    calls,
    playedSfx,
    playedJingles,
    humStates,
    unlock: () => void calls.push('unlock'),
    play: (sfxId: SfxId) => {
      calls.push('play');
      playedSfx.push(sfxId);
    },
    playAll: (sfxIds: readonly SfxId[]) => {
      calls.push('playAll');
      playedSfx.push(...sfxIds);
    },
    playJingle: (jingleId: JingleId) => {
      calls.push('playJingle');
      playedJingles.push(jingleId);
    },
    setEngineHum: (state: EngineHumState) => void humStates.push(state),
    setMuted: (isMuted: boolean) => void calls.push(`setMuted:${isMuted}`),
    suspend: () => void calls.push('suspend'),
    resume: () => void calls.push('resume'),
    dispose: () => void calls.push('dispose'),
  };
}

function createBestScoreStorageStub(): IBestScoreStorage {
  return { read: () => 0, write: () => undefined };
}

function createMutedStorageStub(initialIsMuted = false): IMutedStorage {
  return { read: () => initialIsMuted, write: () => undefined };
}

const IDLE_INPUTS: PlayerInputs = { direction: undefined, fire: false };
const DRIVING_INPUTS: PlayerInputs = { direction: 'up', fire: false };

describe('TanksAudioController', () => {
  let store: TanksStore;
  let engine: IEngineStub;
  let controller: TanksAudioController;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new TanksStore(createBestScoreStorageStub(), createMutedStorageStub());
    engine = createEngineStub();
    controller = new TanksAudioController(store, engine);
  });

  afterEach(() => {
    controller.dispose();
    store.dispose();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('primes the engine with the persisted mute state', () => {
      expect(engine.calls).toContain('setMuted:false');
    });

    it('honors a persisted muted flag', () => {
      const mutedStore = new TanksStore(createBestScoreStorageStub(), createMutedStorageStub(true));
      const mutedEngine = createEngineStub();
      const mutedController = new TanksAudioController(mutedStore, mutedEngine);

      expect(mutedEngine.calls).toContain('setMuted:true');

      mutedController.dispose();
      mutedStore.dispose();
    });
  });

  describe('status transitions', () => {
    it('unlocks and plays the stage-start jingle when a game begins', () => {
      store.startGame();

      expect(engine.calls).toContain('unlock');
      expect(engine.playedJingles).toEqual(['stage-start']);
      expect(engine.humStates).toContain('off');
    });

    it('plays the pause blip without suspending, then resumes on unpause', () => {
      store.startGame();
      store.skipStageIntro();

      store.togglePause();
      expect(engine.playedSfx).toContain('pause-blip');
      expect(engine.calls).not.toContain('suspend');

      store.togglePause();
      expect(engine.calls).toContain('resume');
    });

    it('plays the game-over jingle when the run ends', () => {
      store.startGame();
      store.skipStageIntro();

      store.applyWorldEvents([{ type: 'game-over' }]);

      expect(engine.playedJingles).toContain('game-over');
    });
  });

  describe('mute reaction', () => {
    it('unlocks and forwards every mute flip to the engine', () => {
      store.toggleMute();

      expect(engine.calls).toContain('unlock');
      expect(engine.calls).toContain('setMuted:true');

      store.toggleMute();

      expect(engine.calls).toContain('setMuted:false');
    });
  });

  describe('onTick', () => {
    it('maps world events to sfx and keeps the hum off outside gameplay', () => {
      controller.onTick(IDLE_INPUTS, [{ type: 'game-over' }]);

      expect(engine.calls).toContain('playAll');
      expect(engine.humStates.at(-1)).toBe('off');
    });

    it('drives the hum from the current inputs while playing', () => {
      store.startGame();
      store.skipStageIntro();

      controller.onTick(IDLE_INPUTS, []);
      expect(engine.humStates.at(-1)).toBe('idle');

      controller.onTick(DRIVING_INPUTS, []);
      expect(engine.humStates.at(-1)).toBe('moving');
    });
  });

  describe('dispose', () => {
    it('disposes the engine and stops reacting to the store', () => {
      controller.dispose();
      const callCountAfterDispose = engine.calls.length;

      store.toggleMute();
      store.startGame();

      expect(engine.calls).toContain('dispose');
      expect(engine.calls.length).toBe(callCountAfterDispose);
    });
  });
});
