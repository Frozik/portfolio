import type { IMutedStorage } from '@frozik/utils/storage/mutedStorage';
import { random } from 'lodash-es';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_TANK_HEALTH } from '../domain/constants';
import type { ScorchedInput } from '../infrastructure/scorched-input';
import { EMPTY_INPUT } from '../infrastructure/scorched-input';
import { ScorchedStore } from './ScorchedStore';
import { DEFAULT_ADVANCED_OPTIONS, DEFAULT_SETUP_OPTIONS } from './scorched-setup';

// Terrain, wind and the Moron's aim are all one `random` call away from being unrepeatable, and
// the flows below span whole rounds. Pinned to zero they give a flat field, a dead calm and an
// AI that drops every shell at its own feet — a slow, entirely deterministic suicide.
vi.mock('lodash-es', async importOriginal => {
  const actual = await importOriginal<typeof import('lodash-es')>();

  return { ...actual, random: vi.fn() };
});

const randomMock = vi.mocked(random);

function createMutedStorageStub(): IMutedStorage {
  let isMuted = false;

  return {
    read: () => isMuted,
    write: (next: boolean) => {
      isMuted = next;
    },
  };
}

function createInput(overrides: Partial<ScorchedInput> = {}): ScorchedInput {
  return { ...EMPTY_INPUT, ...overrides };
}

const FRAME_SECONDS = 1 / 60;

function createStore(): ScorchedStore {
  return new ScorchedStore(createMutedStorageStub());
}

/** The default roster pits the human against a Sniper; these flows want two humans. */
function createPlayingStore(): ScorchedStore {
  const store = createStore();

  store.setPlayerController(1, { kind: 'human' });
  store.startMatch();

  return store;
}

/** Walks a whole shot from the trigger pull to the turn changing hands. */
function fireAndSettle(store: ScorchedStore): void {
  store.applyInput(createInput({ isFireRequested: true }));

  while (store.isTicking) {
    store.tick();
  }
}

/** Enough to make the shop worth visiting for a human and worth restocking from for an AI. */
const SHOPPING_CASH = 60000;
const AI_ROUND_FRAME_LIMIT = 4000;
const AI_FRAME_SECONDS = 0.1;

/** Plays through the match-start shop and round 1 into the shop that follows it. */
function reachFirstShop(store: ScorchedStore): void {
  store.setPlayerController(1, { kind: 'human' });
  store.setSetupOptions({ ...DEFAULT_SETUP_OPTIONS, startingCash: SHOPPING_CASH });
  store.startMatch();
  store.leaveShop();
  store.leaveShop();
  store.confirmHandover();
  store.applyInput(createInput({ powerDelta: 400 }));
  fireAndSettle(store);
  store.confirmHandover();
  store.retreat();
  store.continueAfterRound();
}

function playUntilRoundOver(store: ScorchedStore): void {
  for (let frame = 0; frame < AI_ROUND_FRAME_LIMIT && store.status === 'playing'; frame++) {
    store.advanceFrame(AI_FRAME_SECONDS);

    while (store.isTicking) {
      store.tick();
    }
  }
}

function countWeapons(store: ScorchedStore, playerId: number): number {
  return Object.values(store.getMatchPlayer(playerId)?.weapons ?? {}).reduce(
    (total, count) => total + count,
    0
  );
}

beforeEach(() => {
  randomMock.mockReset();
  randomMock.mockReturnValue(0);
});

describe('ScorchedStore', () => {
  it('opens on the roster screen with a round already standing behind it', () => {
    const store = createStore();

    expect(store.status).toBe('setup');
    expect(store.phase).toBe('aiming');
    expect(store.roster).toHaveLength(2);
    expect(store.roundRef.current.field.length).toBeGreaterThan(0);
  });

  it('starts the match with the first player on the clock', () => {
    const store = createPlayingStore();

    expect(store.status).toBe('playing');
    expect(store.isAiming).toBe(true);
    expect(store.activePlayerId).toBe(0);
    expect(store.activePlayer?.health).toBe(MAX_TANK_HEALTH);
  });

  it('keeps the fired weapon selected next turn and falls back once it runs out', () => {
    const store = createStore();

    store.setPlayerController(1, { kind: 'human' });
    store.setSetupOptions({ ...DEFAULT_SETUP_OPTIONS, startingCash: SHOPPING_CASH });
    store.startMatch();
    store.shop.buy({ kind: 'weapon', weaponId: 'nuke' });
    store.shop.buy({ kind: 'weapon', weaponId: 'nuke' });
    store.leaveShop();
    store.leaveShop();
    store.confirmHandover();

    store.selectWeapon('nuke');
    store.applyInput(createInput({ powerDelta: 400 }));
    fireAndSettle(store);
    store.confirmHandover();
    store.applyInput(createInput({ powerDelta: 400 }));
    fireAndSettle(store);
    store.confirmHandover();

    expect(store.activePlayerId).toBe(0);
    expect(store.selectedWeaponId).toBe('nuke');

    fireAndSettle(store);
    store.confirmHandover();
    fireAndSettle(store);
    store.confirmHandover();

    expect(store.activePlayerId).toBe(0);
    expect(store.selectedWeaponId).toBe('baby-missile');
  });

  it('refuses to open the weapon carousel while the shot of another player is in the air', () => {
    const store = createPlayingStore();

    store.applyInput(createInput({ powerDelta: 400 }));
    store.applyInput(createInput({ isFireRequested: true }));

    expect(store.isTicking).toBe(true);

    store.setWeaponCarouselOpen(true);

    expect(store.isWeaponCarouselOpen).toBe(false);

    while (store.isTicking) {
      store.tick();
    }

    store.confirmHandover();
    store.setWeaponCarouselOpen(true);

    expect(store.isWeaponCarouselOpen).toBe(true);
  });

  it('ignores input before the match has been started', () => {
    const store = createStore();
    const powerBefore = store.aimPower;

    store.applyInput(createInput({ powerDelta: 50 }));

    expect(store.aimPower).toBe(powerBefore);
  });

  it('turns the barrel and trims the power from one frame of input', () => {
    const store = createPlayingStore();
    const elevationBefore = store.aimElevationDegrees;

    store.applyInput(createInput({ dialDelta: 5, powerDelta: 120 }));

    expect(store.aimElevationDegrees).toBe(elevationBefore + 5);
    expect(store.aimPower).toBe(120);
    expect(store.aimFacing).toBe('right');
  });

  it('takes a drag gesture as an absolute aim rather than a nudge', () => {
    const store = createPlayingStore();

    store.applyInput(createInput({ powerDelta: 300 }));
    store.applyInput(createInput({ aimOverride: { dialDegrees: 120, power: 500 } }));

    expect(store.aimFacing).toBe('left');
    expect(store.aimElevationDegrees).toBe(60);
    expect(store.aimPower).toBe(500);
  });

  it('caps the power at ten times the health the domain reports', () => {
    const store = createPlayingStore();

    store.applyInput(createInput({ powerDelta: 5000 }));

    expect(store.aimPower).toBe(store.maxPower);
  });

  it('puts a shell in the air on fire and ticks only while it flies', () => {
    const store = createPlayingStore();

    expect(store.isTicking).toBe(false);

    store.applyInput(createInput({ powerDelta: 400 }));
    store.applyInput(createInput({ isFireRequested: true }));

    expect(store.phase).toBe('flight');
    expect(store.isTicking).toBe(true);
    expect(store.roundRef.current.projectiles).toHaveLength(1);
  });

  it('shows the pass-the-device card between two humans', () => {
    const store = createPlayingStore();

    store.applyInput(createInput({ powerDelta: 400 }));
    fireAndSettle(store);

    expect(store.status).toBe('handover');
    expect(store.activePlayerId).toBe(1);

    store.confirmHandover();

    expect(store.status).toBe('playing');
  });

  it('skips the handover entirely when only one human is playing', () => {
    const store = createStore();

    store.setPlayerController(1, { kind: 'ai', personality: 'moron' });
    store.startMatch();
    store.applyInput(createInput({ powerDelta: 400 }));
    fireAndSettle(store);

    expect(store.status).toBe('playing');
    expect(store.isAiTurn).toBe(true);
  });

  it('lets an AI take its own turn after a thinking beat', () => {
    const store = createStore();

    store.setPlayerController(1, { kind: 'ai', personality: 'shooter' });
    store.startMatch();
    store.applyInput(createInput({ powerDelta: 400 }));
    fireAndSettle(store);

    expect(store.advanceFrame(0.1)).toHaveLength(0);
    expect(store.aiThinkingPlayerId).toBe(1);

    // Long enough for the thinking beat and the dial-in to finish, then the shell flies.
    for (let frame = 0; frame < 200 && store.phase === 'aiming'; frame++) {
      store.advanceFrame(0.1);
    }

    expect(store.aiThinkingPlayerId).toBeUndefined();
    expect(store.phase).toBe('flight');
  });

  it('keeps the baby missile selected while nothing else is owned', () => {
    const store = createPlayingStore();

    store.applyInput(createInput({ isWeaponCycleRequested: true }));

    expect(store.selectedWeaponId).toBe('baby-missile');
  });

  it('ages the floating overlays off the field on the frame clock', () => {
    const store = createPlayingStore();

    store.applyInput(createInput({ powerDelta: 400 }));
    fireAndSettle(store);
    store.confirmHandover();

    const popupCount = store.overlays.damagePopups.length;

    store.advanceFrame(5);

    expect(store.overlays.damagePopups.length).toBeLessThanOrEqual(popupCount);
    expect(store.overlays.damagePopups).toHaveLength(0);
  });

  it('persists the mute preference through the injected storage', () => {
    const storage = createMutedStorageStub();
    const store = new ScorchedStore(storage);

    store.toggleMute();

    expect(store.isMuted).toBe(true);
    expect(storage.read()).toBe(true);
  });

  it('replaces the round and its terrain when a new match starts', () => {
    const store = createPlayingStore();
    const firstRound = store.roundRef.current;
    const firstVersion = store.roundRef.version;

    store.startMatch();

    expect(store.roundRef.current).not.toBe(firstRound);
    expect(store.roundRef.version).toBeGreaterThan(firstVersion);
    expect(store.status).toBe('playing');
    expect(store.players.every(player => player.health === MAX_TANK_HEALTH)).toBe(true);
  });
});

describe('ScorchedStore turn actions', () => {
  /** The roster screen has no inventory editor, so a stocked tank is set up through the round. */
  function createStockedStore(): ScorchedStore {
    const store = createStore();

    store.setPlayerController(1, { kind: 'ai', personality: 'moron' });
    store.startMatch();

    return store;
  }

  it('hands the events of a HUD action to the renderer on the next frame', () => {
    const store = createStockedStore();

    store.retreat();

    const events = store.advanceFrame(FRAME_SECONDS);

    expect(events.some(event => event.type === 'tank-retreated')).toBe(true);
  });

  it('drains the queue only once, so nothing is routed twice', () => {
    const store = createStockedStore();

    store.retreat();
    store.advanceFrame(FRAME_SECONDS);

    expect(store.advanceFrame(FRAME_SECONDS).some(event => event.type === 'tank-retreated')).toBe(
      false
    );
  });

  it('takes the retreating tank out of the round', () => {
    const store = createStockedStore();

    store.retreat();

    expect(store.players[0].isAlive).toBe(false);
  });

  it('refuses a turn action while a shell is in the air', () => {
    const store = createStockedStore();

    store.applyInput(createInput({ powerDelta: 400 }));
    store.applyInput(createInput({ isFireRequested: true }));
    store.retreat();

    expect(store.players[0].isAlive).toBe(true);
  });

  it('drops the fuel drive mode when the turn changes hands', () => {
    const store = createStockedStore();

    store.setFuelMoveMode(true);
    store.applyInput(createInput({ powerDelta: 400 }));
    fireAndSettle(store);

    expect(store.isFuelMoveMode).toBe(false);
  });

  it('drives instead of aiming while the fuel mode is on', () => {
    const store = createStockedStore();
    const elevationBefore = store.aimElevationDegrees;

    store.setFuelMoveMode(true);
    store.applyInput(createInput({ dialDelta: 5 }));

    expect(store.aimElevationDegrees).toBe(elevationBefore);
  });
});

describe('ScorchedStore round boundaries', () => {
  it('opens the next round with the pass-the-device card between two humans', () => {
    const store = createStore();

    reachFirstShop(store);
    store.leaveShop();

    expect(store.status).toBe('handover');
    expect(store.activePlayerId).toBe(0);
  });

  it('moves the round number on when the next round opens', () => {
    const store = createStore();

    expect(store.roundNumber).toBe(1);

    reachFirstShop(store);
    store.leaveShop();

    expect(store.roundNumber).toBe(2);
  });

  it('drops the fuel drive mode when the next round opens', () => {
    const store = createStore();

    reachFirstShop(store);
    store.setFuelMoveMode(true);
    store.leaveShop();

    expect(store.isFuelMoveMode).toBe(false);
  });

  it('restocks the AIs that survived the round and leaves the dead ones alone', () => {
    const store = createStore();

    // Elevation draws (0..90) pin to straight up, everything else to zero: each Moron drops its
    // own zero-power shell back onto its turret and they suicide in turn order, first mover first.
    randomMock.mockImplementation((lower?: unknown, upper?: unknown) =>
      lower === 0 && upper === 90 ? 90 : 0
    );
    store.setPlayerController(0, { kind: 'ai', personality: 'moron' });
    store.setPlayerController(1, { kind: 'ai', personality: 'moron' });
    store.setSetupOptions({
      ...DEFAULT_SETUP_OPTIONS,
      // Enough for a weapon but not for the defence run — a self-shelling Moron with a shield
      // up would outlive the round's frame budget.
      startingCash: 15000,
      advanced: { ...DEFAULT_ADVANCED_OPTIONS, isTunnelingEnabled: false },
    });
    store.startMatch();
    playUntilRoundOver(store);

    expect(store.status).toBe('round-over');
    expect(store.survivorIds).toEqual([1]);

    const deadWeaponsBefore = countWeapons(store, 0);

    store.continueAfterRound();

    expect(countWeapons(store, 1)).toBeGreaterThan(0);
    // The dead player's locker may shrink by what they fired, but a restock would grow it.
    expect(countWeapons(store, 0)).toBeLessThanOrEqual(deadWeaponsBefore);
  });
});

describe('ScorchedStore between-round shop', () => {
  it('shows an accessory bought between rounds from the very first turn of the next round', () => {
    const store = createStore();

    store.setSetupOptions({ ...DEFAULT_SETUP_OPTIONS, startingCash: SHOPPING_CASH });
    store.startMatch();
    store.shop.buy({ kind: 'weapon', weaponId: 'nuke' });
    store.leaveShop();
    store.confirmHandover();

    // A direct nuke hit across the flat 400 wu spawn gap ends round 1 with the AI dead.
    store.roundRef.current.setAim({ facing: 'right', elevationDegrees: 45, power: 686.8 });
    store.selectWeapon('nuke');
    fireAndSettle(store);

    expect(store.status).toBe('round-over');

    store.continueAfterRound();

    expect(store.shop.buy({ kind: 'item', itemId: 'shield' })).toBe(true);

    store.leaveShop();
    store.confirmHandover();

    expect(store.status).toBe('playing');
    expect(store.turnItemCounts.shield).toBeGreaterThan(0);
  });
});

describe('ScorchedStore match-start shop', () => {
  it('opens the shop before round 1 when starting cash is set', () => {
    const store = createStore();

    store.setSetupOptions({ ...DEFAULT_SETUP_OPTIONS, startingCash: SHOPPING_CASH });
    store.startMatch();

    expect(store.status).toBe('shop');
  });

  it('starts round 1 straight away when nobody has money to spend', () => {
    const store = createPlayingStore();

    expect(store.status).toBe('playing');
  });

  it('starts round 1 once every shopper has left the match-start shop', () => {
    const store = createStore();

    store.setPlayerController(1, { kind: 'human' });
    store.setSetupOptions({ ...DEFAULT_SETUP_OPTIONS, startingCash: SHOPPING_CASH });
    store.startMatch();
    store.leaveShop();
    store.leaveShop();

    expect(store.status).toBe('handover');
    expect(store.roundNumber).toBe(1);
  });
});

describe('ScorchedStore shields', () => {
  it('puts one of the tank’s own bubbles up on its turn', () => {
    const store = createStore();

    reachFirstShop(store);
    store.shop.buy({ kind: 'item', itemId: 'shield' });

    const bought = store.shop.getOwnedCount(0, { kind: 'item', itemId: 'shield' });

    store.leaveShop();
    store.confirmHandover();
    store.raiseShield('shield');

    expect(store.roundRef.current.getTank(0)?.shield?.tier).toBe('shield');
    expect(store.getItemCount(0, 'shield')).toBe(bought - 1);
  });

  it('refuses to raise one once the shell is already in the air', () => {
    const store = createStore();

    reachFirstShop(store);
    store.shop.buy({ kind: 'item', itemId: 'shield' });
    store.leaveShop();
    store.confirmHandover();

    const bought = store.getItemCount(0, 'shield');

    store.applyInput(createInput({ isFireRequested: true }));
    store.raiseShield('shield');

    expect(store.roundRef.current.getTank(0)?.shield).toBeUndefined();
    expect(store.getItemCount(0, 'shield')).toBe(bought);
  });
});
