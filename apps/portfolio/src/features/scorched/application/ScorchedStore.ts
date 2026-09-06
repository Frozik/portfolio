import { assert } from '@frozik/utils/assert/assert';
import type { Vector2 } from '@frozik/utils/math/vector2';
import type { IMutedStorage } from '@frozik/utils/storage/mutedStorage';
import { createMutedStorage } from '@frozik/utils/storage/mutedStorage';
import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';

import { MIN_PLAYER_COUNT } from '../domain/constants';
import { ScorchedMatch } from '../domain/match';
import type { ScorchedRound } from '../domain/round';
import type { ScorchedInput } from '../domain/scorched-input';
import { getTankCenter } from '../domain/tank-geometry';
import type { PlayerId, WorldEvent } from '../domain/types';
import type { ScorchedRoundRef } from '../infrastructure/scorched-round-ref';
import { AimModel } from './AimModel';
import { AiTurnModel } from './AiTurnModel';
import { OverlayStore } from './OverlayStore';
import { PendingRoundEvents } from './pending-round-events';
import { RosterModel } from './RosterModel';
import { createMatchOptions } from './scorched-setup';
import { ShopStore } from './ShopStore';
import { TurnActionsModel } from './TurnActionsModel';
import type { IScorchedPlayerState } from './WorldModel';
import { WorldModel } from './WorldModel';

/** The whole player-facing flow, from the roster screen to the final standings. */
export type ScorchedGameStatus =
  | 'setup'
  | 'handover'
  | 'playing'
  | 'round-over'
  | 'shop'
  | 'match-over';

/** A freshly opened round together with the events its opening emitted. */
interface OpenedRound {
  readonly round: ScorchedRound;
  readonly events: readonly WorldEvent[];
}

const NO_EVENTS: readonly WorldEvent[] = [];
/** Whether the player silenced the game is remembered across visits. */
const MUTED_STORAGE_KEY = 'scorched:muted';

function openMatchRound(match: ScorchedMatch): OpenedRound {
  const events = [...match.startRound()];
  const round = match.round;

  assert(!isNil(round), 'the match failed to open its round');

  return { round, events };
}

/**
 * The match flow and its composition: the roster, the aim, the turn actions, the shop and the
 * overlays are sub-models; the round and the match sit behind `world` and every HUD figure is a
 * computed over them. The renderer and the audio controller are owned by the shell component —
 * they drive `advanceFrame`, `applyInput` and `tick` and read the events those return.
 */
export class ScorchedStore {
  status: ScorchedGameStatus = 'setup';
  survivorIds: readonly PlayerId[] = [];
  isMuted: boolean;
  fps = 0;
  rendererFailure: string | undefined;

  readonly roster = new RosterModel();
  /** The round and the match, as far as anything observable is allowed to see them. */
  readonly world: WorldModel;
  readonly aim: AimModel;
  readonly turnActions: TurnActionsModel;
  readonly ai: AiTurnModel;
  /** The between-rounds counter, with its own observable state. */
  readonly shop: ShopStore;
  /** The floating health numbers and taunt bubbles drawn over the field. */
  readonly overlays: OverlayStore;

  private readonly mutedStorage: IMutedStorage;
  private readonly pendingEvents = new PendingRoundEvents();

  constructor(mutedStorage: IMutedStorage = createMutedStorage(MUTED_STORAGE_KEY)) {
    this.mutedStorage = mutedStorage;
    this.isMuted = mutedStorage.read();

    // The roster screen is what opens; this round is only here so the renderer has a field to
    // draw behind it, and `startMatch` replaces it outright — its opening events lead nowhere.
    const match = new ScorchedMatch(createMatchOptions(this.roster.players, this.roster.setup));

    this.world = new WorldModel(this.roster, match, openMatchRound(match).round);

    const canAct = (): boolean => this.isAiming && !this.isAiTurn;

    this.aim = new AimModel({ world: this.world, canAct });
    this.ai = new AiTurnModel({
      world: this.world,
      aim: this.aim,
      isAiAiming: () => this.isAiming && this.isAiTurn,
      queueEvents: events => {
        this.queueRoundEvents(events);
      },
      fire: () => this.fire(),
    });
    this.turnActions = new TurnActionsModel({
      world: this.world,
      canAct,
      onEvents: events => {
        this.queueRoundEvents(events);
      },
    });
    this.shop = new ShopStore({
      getMatch: () => this.world.match,
      isCounterOpen: () => this.status === 'shop',
      onMatchChanged: () => {
        this.world.markChanged();
      },
    });
    this.overlays = new OverlayStore({
      getTankCenter: playerId => this.resolveTankCenter(playerId),
      getTalkProbabilityPercent: () => this.roster.setup.advanced.talkProbabilityPercent,
    });

    makeAutoObservable<ScorchedStore, 'mutedStorage' | 'pendingEvents'>(
      this,
      {
        roster: false,
        world: false,
        aim: false,
        turnActions: false,
        ai: false,
        shop: false,
        overlays: false,
        roundRef: false,
        mutedStorage: false,
        pendingEvents: false,
      },
      { autoBind: true }
    );
  }

  /** The live round handle the renderer reads through, across rounds and rematches. */
  get roundRef(): ScorchedRoundRef {
    return this.world.roundRef;
  }

  /** Whether a tick advances the world: only a shot in flight makes the turn-based round move. */
  get isTicking(): boolean {
    return this.status === 'playing' && this.world.phase === 'flight';
  }

  get isAiming(): boolean {
    return this.status === 'playing' && this.world.phase === 'aiming';
  }

  /** True while an AI holds the turn — the human input sources are ignored for its duration. */
  get isAiTurn(): boolean {
    return this.world.activePlayer?.controller.kind === 'ai';
  }

  get shopPlayer(): IScorchedPlayerState | undefined {
    return isNil(this.shop.playerId) ? undefined : this.world.getPlayer(this.shop.playerId);
  }

  toggleMute(): void {
    this.isMuted = !this.isMuted;
    this.mutedStorage.write(this.isMuted);
  }

  /** Leaves the roster screen behind and opens the first round of a brand-new match. */
  startMatch(): void {
    this.world.replaceMatch(
      new ScorchedMatch(createMatchOptions(this.roster.players, this.roster.setup))
    );
    this.ai.reset();
    this.aim.beginMatch();
    this.turnActions.beginTurn();
    this.overlays.clear();

    // Starting cash is meant to be spent before the first shot: the match opens on the shop,
    // and the last shopper's exit is what starts round 1.
    if (this.roster.setup.startingCash > 0) {
      this.survivorIds = this.world.players.map(player => player.id);
      this.shop.runAiShopping(this.aiShopperIds);
      this.shop.setQueue(this.world.humanIds);
      this.openNextShop();

      return;
    }

    const opened = openMatchRound(this.world.match);

    this.world.replaceRound(opened.round);
    this.survivorIds = [];
    // The opening events land before the status settles, which is what keeps the pass-the-device
    // card off the very first turn: whoever pressed Start is already holding the device. Their
    // `turn-started` still runs `beginTurn`, so the per-turn state is armed the same way.
    this.applyRoundEvents(opened.events);
    this.status = 'playing';
  }

  /** Back to the roster screen with the line-up intact, so it can be edited and re-run. */
  returnToSetup(): void {
    this.status = 'setup';
  }

  /** The pass-the-device card is dismissed and the next player takes the controls. */
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

    const { match } = this.world;

    match.completeRound();
    this.world.markChanged();
    this.shop.runAiShopping(this.aiShopperIds);

    if (match.phase === 'finished') {
      this.status = 'match-over';

      return;
    }

    this.shop.setQueue(this.world.humanIds.filter(playerId => this.survivorIds.includes(playerId)));
    this.openNextShop();
  }

  /** The current shopper is done; the next survivor takes their turn at the counter. */
  leaveShop(): void {
    if (this.status === 'shop') {
      this.openNextShop();
    }
  }

  /**
   * One frame of wall-clock time. Everything that ages rather than ticks lives here: the floating
   * damage numbers, the taunt bubbles and the AI winding its barrel across.
   */
  advanceFrame(elapsedSeconds: number): readonly WorldEvent[] {
    this.overlays.age(elapsedSeconds);

    const queued = this.pendingEvents.drain();
    const aiEvents = this.ai.advance(elapsedSeconds);

    return queued.length === 0 ? aiEvents : [...queued, ...aiEvents];
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
      this.aim.cycleWeapon();
    }

    if (this.turnActions.isFuelMoveMode && input.dialDelta !== 0) {
      // The dial turns anticlockwise, so a positive delta is the left arrow — which drives left.
      this.turnActions.driveTank(-input.dialDelta);

      return NO_EVENTS;
    }

    if (!isNil(input.aimOverride)) {
      this.aim.setFromDial(input.aimOverride.dialDegrees, input.aimOverride.power);
    } else if (input.dialDelta !== 0 || input.powerDelta !== 0) {
      this.aim.adjust(input.dialDelta, input.powerDelta);
    }

    return input.isFireRequested ? this.fire() : NO_EVENTS;
  }

  /** Advances the world by one 60 Hz tick. Runs as one action, so the HUD updates atomically. */
  tick(): readonly WorldEvent[] {
    const events = this.world.round.tick();

    this.applyRoundEvents(events);

    return events;
  }

  setFps(fps: number): void {
    this.fps = fps;
  }

  failRenderer(error: unknown): void {
    this.rendererFailure = error instanceof Error ? error.message : String(error);
  }

  dispose(): void {
    this.ai.reset();
    this.shop.dispose();
    this.overlays.dispose();
  }

  /** The AIs that lived to shop; the humans among the survivors queue at the counter instead. */
  private get aiShopperIds(): readonly PlayerId[] {
    return this.world.players
      .filter(player => player.controller.kind === 'ai' && this.survivorIds.includes(player.id))
      .map(player => player.id);
  }

  private fire(): readonly WorldEvent[] {
    const events = this.aim.fire();

    this.applyRoundEvents(events);

    return events;
  }

  /** A HUD action's events reach the renderer on the next frame and the store right away. */
  private queueRoundEvents(events: readonly WorldEvent[]): void {
    if (events.length === 0) {
      return;
    }

    this.pendingEvents.push(events);
    this.applyRoundEvents(events);
  }

  private openNextShop(): void {
    if (!this.shop.openNext()) {
      this.startNextRound();

      return;
    }

    this.status = 'shop';
  }

  private startNextRound(): void {
    const opened = openMatchRound(this.world.match);

    this.shop.close();
    this.survivorIds = [];
    this.overlays.clear();
    this.turnActions.beginTurn();
    this.aim.beginRound();
    this.world.replaceRound(opened.round);
    // Playing first, then the opening events: the shop just changed hands, so the first
    // `turn-started` of the new round is exactly where the pass-the-device card belongs, and a
    // status assigned after it would wipe the card straight off again.
    this.status = 'playing';
    this.applyRoundEvents(opened.events);
  }

  private applyRoundEvents(events: readonly WorldEvent[]): void {
    this.overlays.applyEvents(events);
    this.ai.applyEvents(events);

    for (const event of events) {
      if (event.type === 'turn-started') {
        this.beginTurn(event.playerId);
      } else if (event.type === 'round-ended') {
        this.endRound(event.survivorIds);
      }
    }

    this.world.markChanged();
  }

  /**
   * The pass-the-device card only makes sense between two people in the same room, so it
   * is skipped entirely in a one-human game and never shown when an AI is up next.
   */
  private beginTurn(playerId: PlayerId): void {
    const player = this.world.getPlayer(playerId);

    this.aim.beginTurn(playerId);
    this.turnActions.beginTurn();
    this.overlays.pushTaunt(playerId, 'attack');

    if (player?.controller.kind === 'human' && this.world.humanIds.length >= MIN_PLAYER_COUNT) {
      this.status = 'handover';
    }
  }

  private endRound(survivorIds: readonly PlayerId[]): void {
    this.survivorIds = survivorIds;
    this.ai.endRound();
    this.status = 'round-over';
  }

  private resolveTankCenter(playerId: PlayerId): Vector2 | undefined {
    const tank = this.world.round.getTank(playerId);

    return isNil(tank) ? undefined : getTankCenter(tank);
  }
}
