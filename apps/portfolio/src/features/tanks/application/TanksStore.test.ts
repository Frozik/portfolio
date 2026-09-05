import type { IMutedStorage } from '@frozik/utils/storage/mutedStorage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ENEMIES_PER_STAGE, INITIAL_LIVES } from '../domain/constants';
import type { IBestScoreStorage } from '../domain/ports/best-score-storage';
import { TanksStore } from './TanksStore';

const STAGE_INTRO_DURATION_MS = 2000;
const STAGE_CLEAR_DURATION_MS = 2500;
/** The rise (128 ticks) plus the hold (144 ticks). */
const GAME_OVER_DURATION_MS = ((128 + 144) * 1000) / 60;

function setDocumentHidden(isHidden: boolean): void {
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(isHidden);
}

function createBestScoreStorageStub(initialBestScore = 0): IBestScoreStorage & {
  readonly writes: number[];
} {
  const writes: number[] = [];

  return {
    writes,
    read: () => initialBestScore,
    write: (score: number) => void writes.push(score),
  };
}

function createMutedStorageStub(initialIsMuted = false): IMutedStorage & {
  readonly writes: boolean[];
} {
  const writes: boolean[] = [];

  return {
    writes,
    read: () => initialIsMuted,
    write: (isMuted: boolean) => void writes.push(isMuted),
  };
}

describe('TanksStore', () => {
  let store: TanksStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new TanksStore(createBestScoreStorageStub());
  });

  afterEach(() => {
    store.dispose();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('opening state', () => {
    it('opens on the title screen with a fresh run', () => {
      expect(store.gameStatus).toBe('menu');
      expect(store.stageNumber).toBe(1);
      expect(store.score).toBe(0);
      expect(store.lives).toBe(INITIAL_LIVES);
      expect(store.enemiesRemaining).toBe(ENEMIES_PER_STAGE);
      expect(store.isPlaying).toBe(false);
    });
  });

  describe('stage flow', () => {
    it('runs menu → stage intro → playing', () => {
      store.startGame();
      expect(store.gameStatus).toBe('stage-intro');
      expect(store.isPlaying).toBe(false);

      vi.advanceTimersByTime(STAGE_INTRO_DURATION_MS);

      expect(store.gameStatus).toBe('playing');
    });

    it('lets the player skip the curtain instead of waiting it out', () => {
      store.startGame();
      store.skipStageIntro();

      expect(store.gameStatus).toBe('playing');

      // The elapsed intro timer must not fire a second transition behind the player's back.
      vi.advanceTimersByTime(STAGE_INTRO_DURATION_MS);
      expect(store.gameStatus).toBe('playing');
    });

    it('ignores a skip outside the curtain', () => {
      store.skipStageIntro();

      expect(store.gameStatus).toBe('menu');
    });

    it('shows the summary on stage clear and then opens the next stage', () => {
      store.startGame();
      vi.advanceTimersByTime(STAGE_INTRO_DURATION_MS);

      store.applyWorldEvents([{ type: 'stage-cleared', stageNumber: 1 }]);

      expect(store.gameStatus).toBe('stage-clear');
      expect(store.stageSummary?.stageNumber).toBe(1);

      vi.advanceTimersByTime(STAGE_CLEAR_DURATION_MS);

      expect(store.gameStatus).toBe('stage-intro');
      expect(store.stageSummary).toBeUndefined();
    });

    it('reports what the cleared stage was worth', () => {
      store.startGame();
      vi.advanceTimersByTime(STAGE_INTRO_DURATION_MS);

      store.applyWorldEvents([
        { type: 'enemy-destroyed', enemyType: 'basic', position: { x: 0, y: 0 }, points: 100 },
        { type: 'score-awarded', points: 100, totalScore: 100 },
        { type: 'enemy-destroyed', enemyType: 'fast', position: { x: 0, y: 0 }, points: 200 },
        { type: 'score-awarded', points: 200, totalScore: 300 },
        { type: 'stage-cleared', stageNumber: 1 },
      ]);

      expect(store.stageSummary).toEqual({
        stageNumber: 1,
        enemiesDestroyed: 2,
        points: 300,
      });
    });

    it('starts the tally of the next stage from zero', () => {
      store.startGame();
      vi.advanceTimersByTime(STAGE_INTRO_DURATION_MS);
      store.applyWorldEvents([
        { type: 'enemy-destroyed', enemyType: 'basic', position: { x: 0, y: 0 }, points: 100 },
        { type: 'stage-cleared', stageNumber: 1 },
      ]);
      vi.advanceTimersByTime(STAGE_CLEAR_DURATION_MS);
      vi.advanceTimersByTime(STAGE_INTRO_DURATION_MS);

      store.applyWorldEvents([{ type: 'stage-cleared', stageNumber: 1 }]);

      expect(store.stageSummary?.enemiesDestroyed).toBe(0);
    });
  });

  describe('game over', () => {
    it('ends the run when the world says so', () => {
      store.startGame();
      vi.advanceTimersByTime(STAGE_INTRO_DURATION_MS);

      store.applyWorldEvents([{ type: 'game-over' }]);

      expect(store.gameStatus).toBe('game-over');
    });

    it('lets a base blown up in the clearing tick win over the stage-clear', () => {
      store.startGame();
      vi.advanceTimersByTime(STAGE_INTRO_DURATION_MS);

      store.applyWorldEvents([
        { type: 'stage-cleared', stageNumber: 1 },
        { type: 'base-destroyed' },
        { type: 'game-over' },
      ]);

      expect(store.gameStatus).toBe('game-over');

      // No stage-clear timer may survive the game over and push the run on anyway.
      vi.advanceTimersByTime(STAGE_CLEAR_DURATION_MS);
      expect(store.gameStatus).toBe('game-over');
    });

    it('returns to the menu with a brand-new run', () => {
      store.startGame();
      vi.advanceTimersByTime(STAGE_INTRO_DURATION_MS);
      store.applyWorldEvents([
        { type: 'score-awarded', points: 400, totalScore: 400 },
        { type: 'game-over' },
      ]);

      store.returnToMenu();

      expect(store.gameStatus).toBe('menu');
      expect(store.score).toBe(0);
      expect(store.stageNumber).toBe(1);
      expect(store.lives).toBe(INITIAL_LIVES);
      expect(store.enemiesRemaining).toBe(ENEMIES_PER_STAGE);
      expect(store.stageSummary).toBeUndefined();
    });

    it('holds the card through the rise and then returns to the title screen', () => {
      store.startGame();
      vi.advanceTimersByTime(STAGE_INTRO_DURATION_MS);
      store.applyWorldEvents([{ type: 'game-over' }]);

      vi.advanceTimersByTime(GAME_OVER_DURATION_MS - 1);
      expect(store.gameStatus).toBe('game-over');

      vi.advanceTimersByTime(1);
      expect(store.gameStatus).toBe('menu');
    });

    it('lets Play again beat the hold to the menu', () => {
      store.startGame();
      vi.advanceTimersByTime(STAGE_INTRO_DURATION_MS);
      store.applyWorldEvents([{ type: 'game-over' }]);

      store.returnToMenu();
      expect(store.gameStatus).toBe('menu');

      // The hold must not fire behind a player who already started a new game.
      store.startGame();
      vi.advanceTimersByTime(GAME_OVER_DURATION_MS);
      expect(store.gameStatus).toBe('playing');
    });

    it('plays a second run from the restarted menu', () => {
      store.startGame();
      vi.advanceTimersByTime(STAGE_INTRO_DURATION_MS);
      store.applyWorldEvents([{ type: 'game-over' }]);
      store.returnToMenu();

      store.startGame();
      vi.advanceTimersByTime(STAGE_INTRO_DURATION_MS);

      expect(store.gameStatus).toBe('playing');
    });
  });

  describe('best score', () => {
    it('tracks the running score as soon as it passes the record', () => {
      const storage = createBestScoreStorageStub(300);
      const freshStore = new TanksStore(storage);

      freshStore.startGame();
      vi.advanceTimersByTime(STAGE_INTRO_DURATION_MS);
      freshStore.applyWorldEvents([{ type: 'score-awarded', points: 100, totalScore: 100 }]);

      expect(freshStore.bestScore).toBe(300);
      expect(storage.writes).toEqual([]);

      freshStore.dispose();
    });

    it('persists a new record once the run ends', () => {
      const storage = createBestScoreStorageStub(300);
      const freshStore = new TanksStore(storage);

      freshStore.startGame();
      vi.advanceTimersByTime(STAGE_INTRO_DURATION_MS);
      freshStore.applyWorldEvents([
        { type: 'score-awarded', points: 900, totalScore: 900 },
        { type: 'game-over' },
      ]);

      expect(freshStore.bestScore).toBe(900);
      expect(storage.writes).toEqual([900]);

      freshStore.dispose();
    });

    it('never writes a score the record already beats', () => {
      const storage = createBestScoreStorageStub(5000);
      const freshStore = new TanksStore(storage);

      freshStore.startGame();
      vi.advanceTimersByTime(STAGE_INTRO_DURATION_MS);
      freshStore.applyWorldEvents([
        { type: 'score-awarded', points: 100, totalScore: 100 },
        { type: 'game-over' },
      ]);
      freshStore.dispose();

      expect(storage.writes).toEqual([]);
    });

    it('reads the stored record on startup', () => {
      const freshStore = new TanksStore(createBestScoreStorageStub(12_345));

      expect(freshStore.bestScore).toBe(12_345);

      freshStore.dispose();
    });

    it('keeps the record across a restart', () => {
      const storage = createBestScoreStorageStub();
      const freshStore = new TanksStore(storage);

      freshStore.startGame();
      vi.advanceTimersByTime(STAGE_INTRO_DURATION_MS);
      freshStore.applyWorldEvents([
        { type: 'score-awarded', points: 700, totalScore: 700 },
        { type: 'game-over' },
      ]);
      freshStore.returnToMenu();

      expect(freshStore.score).toBe(0);
      expect(freshStore.bestScore).toBe(700);

      freshStore.dispose();
    });
  });

  describe('mute', () => {
    it('starts unmuted for a first-time visitor', () => {
      expect(store.isMuted).toBe(false);
    });

    it('restores the stored preference', () => {
      const mutedStore = new TanksStore(createBestScoreStorageStub(), createMutedStorageStub(true));

      expect(mutedStore.isMuted).toBe(true);

      mutedStore.dispose();
    });

    it('persists both directions of the toggle', () => {
      const mutedStorage = createMutedStorageStub();
      const freshStore = new TanksStore(createBestScoreStorageStub(), mutedStorage);

      freshStore.toggleMute();
      expect(freshStore.isMuted).toBe(true);

      freshStore.toggleMute();
      expect(freshStore.isMuted).toBe(false);
      expect(mutedStorage.writes).toEqual([true, false]);

      freshStore.dispose();
    });
  });

  describe('pause', () => {
    it('toggles pause both ways', () => {
      store.startGame();
      vi.advanceTimersByTime(STAGE_INTRO_DURATION_MS);

      store.togglePause();
      expect(store.gameStatus).toBe('paused');

      store.togglePause();
      expect(store.gameStatus).toBe('playing');
    });

    it('never leaves the menu or an interlude through pause', () => {
      store.togglePause();
      expect(store.gameStatus).toBe('menu');

      store.startGame();
      store.togglePause();
      expect(store.gameStatus).toBe('stage-intro');
    });

    it('auto-pauses when the tab is hidden', () => {
      store.startGame();
      vi.advanceTimersByTime(STAGE_INTRO_DURATION_MS);
      setDocumentHidden(true);

      document.dispatchEvent(new Event('visibilitychange'));

      expect(store.gameStatus).toBe('paused');
    });

    it('keeps the menu untouched when the tab is hidden', () => {
      setDocumentHidden(true);

      document.dispatchEvent(new Event('visibilitychange'));

      expect(store.gameStatus).toBe('menu');
    });

    it('stops reacting to visibility once disposed', () => {
      store.startGame();
      vi.advanceTimersByTime(STAGE_INTRO_DURATION_MS);
      store.dispose();
      setDocumentHidden(true);

      document.dispatchEvent(new Event('visibilitychange'));

      expect(store.gameStatus).toBe('playing');
    });
  });

  describe('teardown', () => {
    it('disposes idempotently', () => {
      store.dispose();

      expect(() => store.dispose()).not.toThrow();
    });

    it('cancels a pending flow step so a disposed store never wakes up', () => {
      store.startGame();
      store.dispose();

      vi.advanceTimersByTime(STAGE_INTRO_DURATION_MS);

      expect(store.gameStatus).toBe('stage-intro');
    });
  });
});
