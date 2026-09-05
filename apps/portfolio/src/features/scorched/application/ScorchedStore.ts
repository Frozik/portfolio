import { assert } from '@frozik/utils/assert/assert';
import type { Vector2 } from '@frozik/utils/math/vector2';
import type { IMutedStorage } from '@frozik/utils/storage/mutedStorage';
import { createMutedStorage } from '@frozik/utils/storage/mutedStorage';
import { isNil } from 'lodash-es';
import { makeAutoObservable, runInAction } from 'mobx';

import { getMaxPower } from '../domain/ballistics';
import { MAX_POWER, MIN_PLAYER_COUNT, PLASMA_MIN_BATTERIES } from '../domain/constants';
import type { MatchPlayerState } from '../domain/match';
import { ScorchedMatch } from '../domain/match';
import type { ScorchedRound } from '../domain/round';
import type { MatchStanding, RoundHighlight } from '../domain/scoring';
import { findBiggestHit, findTopDamageDealer } from '../domain/scoring';
import { getTankCenter } from '../domain/tank-geometry';
import type {
  AimState,
  GuidanceKind,
  ItemCounts,
  ItemId,
  PlayerController,
  PlayerId,
  PlayerSetup,
  RoundPhase,
  TurretFacing,
  WeaponId,
  WorldEvent,
} from '../domain/types';
import { getFallbackWeaponId, getWeapon, WEAPONS } from '../domain/weapons/catalog';
import { AiTurnDriver } from '../infrastructure/ai-turn-driver';
import { fromDialDegrees, turnDial } from '../infrastructure/aim-dial';
import type { ScorchedInput } from '../infrastructure/scorched-input';
import { ScorchedRoundRef } from '../infrastructure/scorched-round-ref';
import { OverlayStore } from './OverlayStore';
import type { ScorchedSetupOptions } from './scorched-setup';
import { createMatchOptions, DEFAULT_SETUP_OPTIONS } from './scorched-setup';
import { ShopStore } from './ShopStore';

/** The whole player-facing flow of §13, from the roster screen to the final standings. */
export type ScorchedGameStatus =
  | 'setup'
  | 'handover'
  | 'playing'
  | 'round-over'
  | 'shop'
  | 'match-over';

/** What the HUD strip, the roster card and the result overlays read for one player. */
export interface IScorchedPlayerState {
  readonly id: PlayerId;
  name: string;
  controller: PlayerController;
  health: number;
  isAlive: boolean;
  cash: number;
  kills: number;
}

export interface IRoundHighlights {
  readonly biggestHit: RoundHighlight | undefined;
  readonly topDamage: RoundHighlight | undefined;
}

/** A freshly opened round together with the events its opening emitted. */
interface OpenedRound {
  readonly round: ScorchedRound;
  readonly events: readonly WorldEvent[];
}

/** [§12.2] Everything armed for the next trigger pull; all of it is spent by the shot. */
export interface IShotSetup {
  readonly guidance: GuidanceKind | undefined;
  readonly hasContactTrigger: boolean;
  readonly plasmaBatteries: number;
}

const DEFAULT_ELEVATION_DEGREES = 45;
const HALF_POWER = MAX_POWER / 2;
const NO_EVENTS: readonly WorldEvent[] = [];
/** What the turn actions bar spends mid-turn, mirrored into `turnItemCounts`. */
const TURN_ITEM_IDS: readonly ItemId[] = [
  'fuel',
  'battery',
  'super-mag',
  'heavy-shield',
  'force-shield',
  'shield',
];
const NO_HIGHLIGHTS: IRoundHighlights = { biggestHit: undefined, topDamage: undefined };
const FIRST_PLAYER_NUMBER = 1;
/** §12.3: whether the player silenced the game is remembered across visits. */
const MUTED_STORAGE_KEY = 'scorched:muted';

function createDefaultRoster(): PlayerSetup[] {
  return Array.from({ length: MIN_PLAYER_COUNT }, (_unused, index) => ({
    id: index,
    name: `${index + FIRST_PLAYER_NUMBER}`,
    controller:
      index === 0
        ? { kind: 'human' as const }
        : { kind: 'ai' as const, personality: 'spoiler' as const },
  }));
}

/**
 * Data and data methods only (§12, the lesson tanks learnt the hard way): the roster, the match,
 * the figures the HUD and the shop show, and the aim the player is turning. The renderer and the
 * audio controller are owned by the shell component — they drive `advanceFrame`, `applyInput` and
 * `tick` and read the events those return.
 */
export class ScorchedStore {
  status: ScorchedGameStatus = 'setup';
  phase: RoundPhase = 'aiming';
  activePlayerId: PlayerId | undefined;
  windUnits = 0;
  // Plain observable mirrors of round/match figures: the backing `roundRef`/`match` objects are
  // deliberately non-observable, so a getter over them would be a computed with no dependencies —
  // cached forever after the first read. Synced in syncFromRound()/syncPlayersFromMatch().
  roundNumber = 1;
  roundCount = 0;
  armsLevel = 0;
  interestPercent = 0;
  roundsRemaining = 0;
  players: IScorchedPlayerState[] = [];
  roster: PlayerSetup[] = createDefaultRoster();
  setup: ScorchedSetupOptions = DEFAULT_SETUP_OPTIONS;
  aimElevationDegrees = DEFAULT_ELEVATION_DEGREES;
  aimPower = HALF_POWER;
  aimFacing: TurretFacing = 'right';
  maxPower = MAX_POWER;
  selectedWeaponId: WeaponId = getFallbackWeaponId();
  shotSetup: IShotSetup = {
    guidance: undefined,
    hasContactTrigger: false,
    plasmaBatteries: PLASMA_MIN_BATTERIES,
  };
  isWeaponCarouselOpen = false;
  /**
   * [MANUAL §7] While this is on the arrow keys drive the tank on its fuel instead of turning the
   * barrel. It is a mode rather than a second pair of keys because the original made the same
   * choice, and because a phone has nowhere to put another pair of steppers.
   */
  isFuelMoveMode = false;
  /**
   * Observable mirror of the active tank's turn-relevant locker: the round's inventory lives
   * behind the non-observable `roundRef`, so the HUD would never see fuel or a shield leave it.
   * Synced on every turn opening and after every turn action.
   */
  turnItemCounts: ItemCounts = {};
  survivorIds: readonly PlayerId[] = [];
  roundHighlights: IRoundHighlights = NO_HIGHLIGHTS;
  standings: readonly MatchStanding[] = [];
  aiThinkingPlayerId: PlayerId | undefined;
  isMuted: boolean;
  fps = 0;

  /** The live round handle the renderer reads through, across rounds and rematches. */
  readonly roundRef: ScorchedRoundRef;
  /** [§13] The between-rounds counter, with its own observable state. */
  readonly shop: ShopStore;
  /** [§12, §13] The floating health numbers and taunt bubbles drawn over the field. */
  readonly overlays: OverlayStore;

  private readonly mutedStorage: IMutedStorage;
  private readonly aiDriver = new AiTurnDriver();
  private match: ScorchedMatch;
  private pendingEvents: WorldEvent[] = [];
  private readonly rememberedWeapons = new Map<PlayerId, WeaponId>();

  constructor(mutedStorage: IMutedStorage = createMutedStorage(MUTED_STORAGE_KEY)) {
    this.mutedStorage = mutedStorage;
    this.isMuted = mutedStorage.read();
    this.match = new ScorchedMatch(createMatchOptions(this.roster, this.setup));
    // The roster screen is what opens; this round is only here so the renderer has a field to
    // draw behind it, and `startMatch` replaces it outright — its opening events lead nowhere.
    this.roundRef = new ScorchedRoundRef(this.openRound().round);
    this.shop = new ShopStore({
      getMatch: () => this.match,
      isCounterOpen: () => this.status === 'shop',
      onMatchChanged: () => {
        this.syncPlayersFromMatch();
      },
    });
    this.overlays = new OverlayStore({
      getTankCenter: playerId => this.resolveTankCenter(playerId),
      getTalkProbabilityPercent: () => this.setup.advanced.talkProbabilityPercent,
    });

    makeAutoObservable<
      ScorchedStore,
      'mutedStorage' | 'aiDriver' | 'match' | 'pendingEvents' | 'rememberedWeapons'
    >(
      this,
      {
        roundRef: false,
        shop: false,
        overlays: false,
        mutedStorage: false,
        aiDriver: false,
        match: false,
        pendingEvents: false,
        rememberedWeapons: false,
      },
      { autoBind: true }
    );

    // The constructor body is not an action, and the refcounted store can be constructed while
    // an observer from a previous mount is still live (strict-mode HMR) — so the initial sync
    // has to be wrapped explicitly.
    runInAction(() => {
      this.resetPlayers();
      this.syncFromRound();
    });
  }

  /** Whether a tick advances the world: only a shot in flight makes the turn-based round move. */
  get isTicking(): boolean {
    return this.status === 'playing' && this.phase === 'flight';
  }

  get isAiming(): boolean {
    return this.status === 'playing' && this.phase === 'aiming';
  }

  get activePlayer(): IScorchedPlayerState | undefined {
    return this.players.find(player => player.id === this.activePlayerId);
  }

  /** True while an AI holds the turn — the human input sources are ignored for its duration. */
  get isAiTurn(): boolean {
    return this.activePlayer?.controller.kind === 'ai';
  }

  get shopPlayer(): IScorchedPlayerState | undefined {
    return this.players.find(player => player.id === this.shop.playerId);
  }

  /** What Tab walks and the carousel lists: the free baby missile plus whatever is still owned. */
  get availableWeapons(): readonly { readonly weaponId: WeaponId; readonly count: number }[] {
    const round = this.roundRef.current;
    const playerId = this.activePlayerId;

    if (isNil(playerId)) {
      return [];
    }

    return WEAPONS.filter(
      weapon => weapon.isUnlimited || round.getAmmoCount(playerId, weapon.id) > 0
    ).map(weapon => ({
      weaponId: weapon.id,
      count: weapon.isUnlimited
        ? Number.POSITIVE_INFINITY
        : round.getAmmoCount(playerId, weapon.id),
    }));
  }

  getItemCount(playerId: PlayerId, itemId: ItemId): number {
    return this.roundRef.current.getItemCount(playerId, itemId);
  }

  getMatchPlayer(playerId: PlayerId): MatchPlayerState | undefined {
    return this.match.players.find(player => player.id === playerId);
  }

  setRosterSize(playerCount: number): void {
    const next = Array.from({ length: playerCount }, (_unused, index) => {
      return (
        this.roster[index] ?? {
          id: index,
          name: `${index + FIRST_PLAYER_NUMBER}`,
          controller: { kind: 'ai' as const, personality: 'shooter' as const },
        }
      );
    });

    this.roster = next;
  }

  setPlayerName(playerId: PlayerId, name: string): void {
    this.roster = this.roster.map(player =>
      player.id === playerId ? { ...player, name } : player
    );
  }

  setPlayerController(playerId: PlayerId, controller: PlayerController): void {
    this.roster = this.roster.map(player =>
      player.id === playerId ? { ...player, controller } : player
    );
  }

  setSetupOptions(setup: ScorchedSetupOptions): void {
    this.setup = setup;
  }

  toggleMute(): void {
    this.isMuted = !this.isMuted;
    this.mutedStorage.write(this.isMuted);
  }

  /** Leaves the roster screen behind and opens the first round of a brand-new match. */
  startMatch(): void {
    this.match = new ScorchedMatch(createMatchOptions(this.roster, this.setup));
    this.aiDriver.reset();
    this.rememberedWeapons.clear();

    // Starting cash is meant to be spent before the first shot: the match opens on the shop,
    // and the last shopper's exit is what starts round 1.
    if (this.setup.startingCash > 0) {
      this.standings = [];
      this.roundHighlights = NO_HIGHLIGHTS;
      this.overlays.clear();
      this.isFuelMoveMode = false;
      this.resetPlayers();
      this.survivorIds = this.players.map(player => player.id);
      this.shop.runAiShopping(this.aiShopperIds);
      this.shop.setQueue(
        this.players.filter(player => player.controller.kind === 'human').map(player => player.id)
      );
      this.openNextShop();

      return;
    }

    const opened = this.openRound();

    this.roundRef.replace(opened.round);
    this.survivorIds = [];
    this.standings = [];
    this.roundHighlights = NO_HIGHLIGHTS;
    this.overlays.clear();
    this.isFuelMoveMode = false;
    this.resetPlayers();
    this.resetShot();
    // The opening events land before the status settles, which is what keeps the pass-the-device
    // card off the very first turn: whoever pressed Start is already holding the device. Their
    // `turn-started` still runs `beginTurn`, so the per-turn state is armed the same way.
    this.applyRoundEvents(opened.events);
    this.status = 'playing';
  }

  /** [§13] Back to the roster screen with the line-up intact, so it can be edited and re-run. */
  returnToSetup(): void {
    this.status = 'setup';
  }

  /** [§12.2] The pass-the-device card is dismissed and the next player takes the controls. */
  confirmHandover(): void {
    if (this.status === 'handover') {
      this.status = 'playing';
    }
  }

  /** Closes the round card: banks the winnings, lets the AIs restock and opens the shop. */
  continueAfterRound(): void {
    if (this.status !== 'round-over') {
      return;
    }

    this.match.completeRound();
    this.syncPlayersFromMatch();
    this.shop.runAiShopping(this.aiShopperIds);

    if (this.match.phase === 'finished') {
      this.standings = this.match.standings;
      this.status = 'match-over';

      return;
    }

    this.shop.setQueue(
      this.survivorIds.filter(
        playerId => this.players.find(player => player.id === playerId)?.controller.kind === 'human'
      )
    );
    this.openNextShop();
  }

  /** The current shopper is done; the next survivor takes their turn at the counter. */
  leaveShop(): void {
    if (this.status === 'shop') {
      this.openNextShop();
    }
  }

  /** [MANUAL §8] Helicopter out: forfeits the round's points, but denies the killer their bounty. */
  retreat(): void {
    this.runTurnAction(round => round.retreat());
  }

  /** [MANUAL §7] Spends one battery on the active tank: ten health back, one battery gone. */
  spendBattery(): void {
    this.runTurnAction(round => round.spendBattery());
  }

  /** [MANUAL §7] Puts one of the tank's own bubbles up; a second one replaces the first. */
  raiseShield(itemId: ItemId): void {
    this.runTurnAction(round => round.raiseShield(itemId));
  }

  setFuelMoveMode(isFuelMoveMode: boolean): void {
    this.isFuelMoveMode = isFuelMoveMode;
  }

  /** Positive drives right; one call is one column, paid for out of the tank's fuel. */
  driveTank(direction: number): void {
    this.runTurnAction(round => round.moveWithFuelUnits(direction));

    // An empty tank has nothing left to steer with, and a drive mode still latched on would eat
    // the arrow keys for the rest of the turn without moving anything.
    if (!isNil(this.activePlayerId) && this.getItemCount(this.activePlayerId, 'fuel') <= 0) {
      this.isFuelMoveMode = false;
    }
  }

  /** The weapon you last fired stays selected turn to turn; an emptied locker falls back. */
  private recallWeapon(playerId: PlayerId): WeaponId {
    const remembered = this.rememberedWeapons.get(playerId);

    if (
      isNil(remembered) ||
      (!getWeapon(remembered).isUnlimited &&
        this.roundRef.current.getAmmoCount(playerId, remembered) === 0)
    ) {
      return getFallbackWeaponId();
    }

    return remembered;
  }

  selectWeapon(weaponId: WeaponId): void {
    this.selectedWeaponId = weaponId;
    this.isWeaponCarouselOpen = false;
  }

  setWeaponCarouselOpen(isOpen: boolean): void {
    // The carousel lists the active tank's locker, so out of your aiming turn it would show the
    // opponent's arsenal — opening it is only legal while a human is lining up their own shot.
    this.isWeaponCarouselOpen = isOpen && this.isAiming && !this.isAiTurn;
  }

  setGuidance(guidance: GuidanceKind | undefined): void {
    this.shotSetup = { ...this.shotSetup, guidance };
  }

  setContactTriggerArmed(hasContactTrigger: boolean): void {
    this.shotSetup = { ...this.shotSetup, hasContactTrigger };
  }

  setPlasmaBatteries(plasmaBatteries: number): void {
    this.shotSetup = { ...this.shotSetup, plasmaBatteries };
  }

  /**
   * One frame of wall-clock time. Everything that ages rather than ticks lives here: the floating
   * damage numbers, the taunt bubbles and the AI winding its barrel across (§9, §13).
   */
  advanceFrame(elapsedSeconds: number): readonly WorldEvent[] {
    this.overlays.age(elapsedSeconds);

    const queued = this.drainPendingEvents();
    const aiEvents = this.advanceAiTurn(elapsedSeconds);

    return queued.length === 0 ? aiEvents : [...queued, ...aiEvents];
  }

  private advanceAiTurn(elapsedSeconds: number): readonly WorldEvent[] {
    if (!this.isAiming || !this.isAiTurn) {
      this.aiThinkingPlayerId = undefined;

      return NO_EVENTS;
    }

    const activePlayer = this.activePlayer;

    if (isNil(activePlayer) || activePlayer.controller.kind !== 'ai') {
      return NO_EVENTS;
    }

    const step = this.aiDriver.advance({
      round: this.roundRef.current,
      personality: activePlayer.controller.personality,
      killsByPlayerId: new Map(this.match.players.map(player => [player.id, player.kills])),
      elapsedSeconds,
    });

    this.aiThinkingPlayerId = step.isThinking ? activePlayer.id : undefined;

    if (!isNil(step.shieldItemId)) {
      // Copied out because the round reuses its event array: the same turn's shot would clear it.
      this.queueRoundEvents([...this.roundRef.current.raiseShield(step.shieldItemId)]);
    }

    if (!isNil(step.weaponId)) {
      this.selectedWeaponId = step.weaponId;
    }

    if (!isNil(step.aim)) {
      this.roundRef.current.setAim(step.aim);
      this.syncAim();
    }

    return step.isFireRequested ? this.fire() : NO_EVENTS;
  }

  /**
   * One frame of aiming intent. Returns whatever the round emitted — a shot going off — so the
   * draw orchestrator can hand the same events to the terrain passes.
   */
  applyInput(input: ScorchedInput): readonly WorldEvent[] {
    if (!this.isAiming || this.isAiTurn) {
      return NO_EVENTS;
    }

    if (input.isWeaponCycleRequested) {
      this.cycleWeapon();
    }

    if (this.isFuelMoveMode && input.dialDelta !== 0) {
      // The dial turns anticlockwise, so a positive delta is the left arrow — which drives left.
      this.driveTank(-input.dialDelta);

      return NO_EVENTS;
    }

    if (!isNil(input.aimOverride)) {
      this.setAimFromDial(input.aimOverride.dialDegrees, input.aimOverride.power);
    } else if (input.dialDelta !== 0 || input.powerDelta !== 0) {
      this.adjustAim(input.dialDelta, input.powerDelta);
    }

    return input.isFireRequested ? this.fire() : NO_EVENTS;
  }

  /** Advances the world by one 60 Hz tick. Runs as one action, so the HUD updates atomically. */
  tick(): readonly WorldEvent[] {
    const events = this.roundRef.current.tick();

    this.applyRoundEvents(events);

    return events;
  }

  setFps(fps: number): void {
    this.fps = fps;
  }

  dispose(): void {
    this.aiDriver.reset();
  }

  /** A turn action taken from the HUD rather than from an input device. */
  private runTurnAction(act: (round: ScorchedRound) => readonly WorldEvent[]): void {
    if (!this.isAiming || this.isAiTurn) {
      return;
    }

    this.queueRoundEvents(act(this.roundRef.current));
    this.syncTurnItemCounts();
  }

  private syncTurnItemCounts(): void {
    // Read through the round, not the `activePlayerId` mirror: when a new round opens, the
    // mirror still holds the previous round's end state (no active player), and the counts
    // would sync to nothing until the next turn change.
    const playerId = this.roundRef.current.activePlayerId;

    this.turnItemCounts = isNil(playerId)
      ? {}
      : Object.fromEntries(
          TURN_ITEM_IDS.map(itemId => [itemId, this.getItemCount(playerId, itemId)])
        );
  }

  /**
   * Events produced outside the tick loop — a HUD action, a round opening — still have to reach
   * the renderer's single funnel, because the helicopter, the repair chime and the terrain stamps
   * all hang off it. They are queued here and handed over on the next frame rather than being
   * dropped on the floor the way a plain store mutation would be.
   */
  private queueRoundEvents(events: readonly WorldEvent[]): void {
    if (events.length === 0) {
      return;
    }

    this.pendingEvents.push(...events);
    this.applyRoundEvents(events);
  }

  private drainPendingEvents(): readonly WorldEvent[] {
    if (this.pendingEvents.length === 0) {
      return NO_EVENTS;
    }

    const drained = this.pendingEvents;

    this.pendingEvents = [];

    return drained;
  }

  private fire(): readonly WorldEvent[] {
    const shooterId = this.activePlayerId;
    const events = this.roundRef.current.fire({
      weaponId: this.selectedWeaponId,
      guidance: this.shotSetup.guidance,
      guidanceTarget: this.resolveGuidanceTarget(),
      useContactTrigger: this.shotSetup.hasContactTrigger,
      plasmaBatteries: this.shotSetup.plasmaBatteries,
    });

    if (events.length > 0 && !isNil(shooterId)) {
      this.rememberedWeapons.set(shooterId, this.selectedWeaponId);
    }

    this.resetShot();
    this.applyRoundEvents(events);

    return events;
  }

  /**
   * [MANUAL §7] Every guidance kind needs somewhere to steer towards. The nearest living opponent
   * is used for all of them, including Lazy Boy: a free-form target pick would need a second
   * pointer gesture on top of aiming, and the manual's own point is that guidance is a crutch.
   */
  private resolveGuidanceTarget(): Vector2 | undefined {
    const playerId = this.activePlayerId;

    if (isNil(this.shotSetup.guidance) || isNil(playerId)) {
      return undefined;
    }

    const self = this.roundRef.current.getTank(playerId);

    if (isNil(self)) {
      return undefined;
    }

    return this.roundRef.current.tanks
      .filter(tank => tank.isAlive && tank.playerId !== playerId)
      .map(tank => getTankCenter(tank))
      .reduce<Vector2 | undefined>(
        (nearest, position) =>
          isNil(nearest) ||
          Math.abs(position.x - self.columnIndex) < Math.abs(nearest.x - self.columnIndex)
            ? position
            : nearest,
        undefined
      );
  }

  private resetShot(): void {
    this.shotSetup = {
      guidance: undefined,
      hasContactTrigger: false,
      plasmaBatteries: PLASMA_MIN_BATTERIES,
    };
    this.isWeaponCarouselOpen = false;
  }

  /**
   * Opens the match's next round and hands back the events it emitted with it. The round is only
   * ever started once — `ScorchedMatch.startRound` does it — and its `round-started`/`turn-started`
   * pair has to reach `applyRoundEvents`, or the first turn of every round opens with no handover
   * card and last turn's per-turn state still armed.
   */
  private openRound(): OpenedRound {
    const events = [...this.match.startRound()];
    const round = this.match.round;

    assert(!isNil(round), 'the match failed to open its round');

    return { round, events };
  }

  private openNextShop(): void {
    if (!this.shop.openNext()) {
      this.startNextRound();

      return;
    }

    this.status = 'shop';
  }

  private startNextRound(): void {
    const opened = this.openRound();

    this.shop.close();
    this.survivorIds = [];
    this.roundHighlights = NO_HIGHLIGHTS;
    this.overlays.clear();
    this.isFuelMoveMode = false;
    this.roundRef.replace(opened.round);
    this.resetShot();
    this.selectedWeaponId = getFallbackWeaponId();
    this.syncPlayersFromMatch();
    // Playing first, then the opening events: the shop just changed hands, so the first
    // `turn-started` of the new round is exactly where the pass-the-device card belongs, and a
    // status assigned after it would wipe the card straight off again.
    this.status = 'playing';
    this.applyRoundEvents(opened.events);
  }

  /** The AIs that lived to shop; the humans among the survivors queue at the counter instead. */
  private get aiShopperIds(): readonly PlayerId[] {
    return this.players
      .filter(player => player.controller.kind === 'ai' && this.survivorIds.includes(player.id))
      .map(player => player.id);
  }

  private resetPlayers(): void {
    this.players = this.roster.map(player => ({
      id: player.id,
      name: player.name,
      controller: player.controller,
      health: 0,
      isAlive: false,
      cash: 0,
      kills: 0,
    }));
    this.syncPlayersFromMatch();
  }

  private syncPlayersFromMatch(): void {
    this.roundCount = this.match.roundCount;
    this.armsLevel = this.match.armsLevel;
    this.interestPercent = this.match.interestPercent;
    this.roundsRemaining = this.match.roundsRemaining;

    for (const player of this.players) {
      const matchPlayer = this.getMatchPlayer(player.id);

      if (!isNil(matchPlayer)) {
        player.cash = matchPlayer.cash;
        player.kills = matchPlayer.kills;
      }
    }
  }

  private applyRoundEvents(events: readonly WorldEvent[]): void {
    for (const event of events) {
      this.applyRoundEvent(event);
    }

    this.syncFromRound();
  }

  private applyRoundEvent(event: WorldEvent): void {
    switch (event.type) {
      case 'tank-damaged':
        this.overlays.pushHealthPopup(event.playerId, 'damage', event.amount);
        this.aiDriver.recordAttack(event.playerId, event.sourceId);
        break;
      case 'tank-repaired':
        this.overlays.pushHealthPopup(event.playerId, 'repair', event.amount);
        break;
      case 'tank-destroyed':
        this.overlays.pushTaunt(event.playerId, 'death');
        break;
      case 'projectile-ended':
        this.aiDriver.recordImpact(event.position);
        break;
      case 'turn-started':
        this.beginTurn(event.playerId);
        break;
      case 'round-ended':
        this.endRound(event.survivorIds);
        break;
      default:
        break;
    }
  }

  /**
   * [§12.2] The pass-the-device card only makes sense between two people in the same room, so it
   * is skipped entirely in a one-human game and never shown when an AI is up next.
   */
  private beginTurn(playerId: PlayerId): void {
    const player = this.players.find(candidate => candidate.id === playerId);
    const humanCount = this.players.filter(
      candidate => candidate.controller.kind === 'human'
    ).length;

    this.selectedWeaponId = this.recallWeapon(playerId);
    this.resetShot();
    this.isFuelMoveMode = false;
    this.syncTurnItemCounts();
    this.overlays.pushTaunt(playerId, 'attack');

    if (player?.controller.kind === 'human' && humanCount >= MIN_PLAYER_COUNT) {
      this.status = 'handover';
    }
  }

  private endRound(survivorIds: readonly PlayerId[]): void {
    const outcome = this.roundRef.current.outcome;

    this.survivorIds = survivorIds;
    this.roundHighlights = {
      biggestHit: findBiggestHit(outcome),
      topDamage: findTopDamageDealer(outcome),
    };
    this.aiThinkingPlayerId = undefined;
    this.status = 'round-over';
  }

  private resolveTankCenter(playerId: PlayerId): Vector2 | undefined {
    const tank = this.roundRef.current.getTank(playerId);

    return isNil(tank) ? undefined : getTankCenter(tank);
  }

  /**
   * Everything the HUD shows is read back from the round rather than accumulated from events:
   * the round owns those figures, and MobX skips notifying observers when a primitive is
   * reassigned its current value, so a quiet tick re-renders nothing.
   */
  private syncFromRound(): void {
    const round = this.roundRef.current;

    this.phase = round.phase;
    this.activePlayerId = round.activePlayerId;
    this.windUnits = round.windUnits;
    this.roundNumber = round.roundNumber;

    for (const tank of round.tanks) {
      const player = this.players.find(candidate => candidate.id === tank.playerId);

      if (!isNil(player)) {
        player.health = tank.health;
        player.isAlive = tank.isAlive;
      }
    }

    this.syncAim();
  }

  private syncAim(): void {
    const activeTank = isNil(this.activePlayerId)
      ? undefined
      : this.roundRef.current.getTank(this.activePlayerId);

    if (isNil(activeTank)) {
      return;
    }

    this.aimElevationDegrees = activeTank.aim.elevationDegrees;
    this.aimPower = activeTank.aim.power;
    this.aimFacing = activeTank.aim.facing;
    this.maxPower = getMaxPower(activeTank.health);
  }

  private adjustAim(dialDelta: number, powerDelta: number): void {
    const round = this.roundRef.current;
    const activeTank = isNil(this.activePlayerId) ? undefined : round.getTank(this.activePlayerId);

    if (isNil(activeTank)) {
      return;
    }

    const turned: AimState = turnDial(activeTank.aim, dialDelta);

    round.setAim({ ...turned, power: activeTank.aim.power + powerDelta });
    this.syncAim();
  }

  /** [§12.2] A drag names the aim outright rather than nudging whatever was there before. */
  private setAimFromDial(dialDegrees: number, power: number): void {
    const round = this.roundRef.current;

    if (isNil(this.activePlayerId) || isNil(round.getTank(this.activePlayerId))) {
      return;
    }

    round.setAim({ ...fromDialDegrees(dialDegrees), power });
    this.syncAim();
  }

  /** [§12] Tab walks the arsenal: the free baby missile plus whatever the tank still owns. */
  private cycleWeapon(): void {
    const available = this.availableWeapons.map(entry => entry.weaponId);

    if (available.length === 0) {
      return;
    }

    const currentIndex = available.indexOf(this.selectedWeaponId);

    this.selectedWeaponId = available[(currentIndex + 1) % available.length];
  }
}
