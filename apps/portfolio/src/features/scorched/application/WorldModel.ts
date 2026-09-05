import { createAtom, makeAutoObservable } from 'mobx';

import type { MatchPlayerState, ScorchedMatch } from '../domain/match';
import type { ScorchedRound } from '../domain/round';
import type { MatchStanding, RoundHighlight } from '../domain/scoring';
import { findBiggestHit, findTopDamageDealer } from '../domain/scoring';
import type { ItemId, PlayerController, PlayerId, RoundPhase } from '../domain/types';
import { ScorchedRoundRef } from '../infrastructure/scorched-round-ref';
import type { RosterModel } from './RosterModel';

/** What the HUD strip, the roster card and the result overlays read for one player. */
export interface IScorchedPlayerState {
  readonly id: PlayerId;
  readonly name: string;
  readonly controller: PlayerController;
  readonly health: number;
  readonly isAlive: boolean;
  readonly cash: number;
  readonly kills: number;
}

export interface IRoundHighlights {
  readonly biggestHit: RoundHighlight | undefined;
  readonly topDamage: RoundHighlight | undefined;
}

const NO_HIGHLIGHTS: IRoundHighlights = { biggestHit: undefined, topDamage: undefined };

/**
 * The round and the match as the HUD sees them. Both run outside MobX — a 60 Hz world is no place
 * for proxies — and are read through one atom instead: every driven change is reported on it, so
 * the computeds here follow every tick, every purchase and every swap without keeping copies.
 */
export class WorldModel {
  /** The renderer's stable handle onto the current round, across rounds and rematches. */
  readonly roundRef: ScorchedRoundRef;

  private readonly atom = createAtom('ScorchedWorld');
  private readonly roster: RosterModel;
  private matchValue: ScorchedMatch;

  constructor(roster: RosterModel, match: ScorchedMatch, round: ScorchedRound) {
    this.roster = roster;
    this.matchValue = match;
    this.roundRef = new ScorchedRoundRef(round);

    makeAutoObservable<WorldModel, 'atom' | 'roster' | 'matchValue'>(
      this,
      {
        roundRef: false,
        atom: false,
        roster: false,
        matchValue: false,
        round: false,
        match: false,
      },
      { autoBind: true }
    );
  }

  /** Subscribes the calling derivation to the world; plain reads elsewhere cost nothing. */
  get round(): ScorchedRound {
    this.atom.reportObserved();

    return this.roundRef.current;
  }

  get match(): ScorchedMatch {
    this.atom.reportObserved();

    return this.matchValue;
  }

  get phase(): RoundPhase {
    return this.round.phase;
  }

  get activePlayerId(): PlayerId | undefined {
    return this.round.activePlayerId;
  }

  get windUnits(): number {
    return this.round.windUnits;
  }

  get roundNumber(): number {
    return this.round.roundNumber;
  }

  get roundCount(): number {
    return this.match.roundCount;
  }

  get armsLevel(): number {
    return this.match.armsLevel;
  }

  get interestPercent(): number {
    return this.match.interestPercent;
  }

  get roundsRemaining(): number {
    return this.match.roundsRemaining;
  }

  get players(): readonly IScorchedPlayerState[] {
    const { match, round } = this;

    return this.roster.players.map(setup => {
      const matchPlayer = match.players.find(player => player.id === setup.id);
      const tank = round.getTank(setup.id);

      return {
        id: setup.id,
        name: setup.name,
        controller: setup.controller,
        health: tank?.health ?? 0,
        isAlive: tank?.isAlive ?? false,
        cash: matchPlayer?.cash ?? 0,
        kills: matchPlayer?.kills ?? 0,
      };
    });
  }

  get activePlayer(): IScorchedPlayerState | undefined {
    return this.players.find(player => player.id === this.activePlayerId);
  }

  get humanIds(): readonly PlayerId[] {
    return this.players
      .filter(player => player.controller.kind === 'human')
      .map(player => player.id);
  }

  get standings(): readonly MatchStanding[] {
    const { match } = this;

    return match.phase === 'finished' ? match.standings : [];
  }

  get roundHighlights(): IRoundHighlights {
    const { round } = this;

    if (round.phase !== 'ended') {
      return NO_HIGHLIGHTS;
    }

    return {
      biggestHit: findBiggestHit(round.outcome),
      topDamage: findTopDamageDealer(round.outcome),
    };
  }

  getPlayer(playerId: PlayerId): IScorchedPlayerState | undefined {
    return this.players.find(player => player.id === playerId);
  }

  getItemCount(playerId: PlayerId, itemId: ItemId): number {
    return this.round.getItemCount(playerId, itemId);
  }

  getMatchPlayer(playerId: PlayerId): MatchPlayerState | undefined {
    return this.match.players.find(player => player.id === playerId);
  }

  replaceMatch(match: ScorchedMatch): void {
    this.matchValue = match;
    this.markChanged();
  }

  replaceRound(round: ScorchedRound): void {
    this.roundRef.replace(round);
    this.markChanged();
  }

  /** After driving the round or the match, so the derivations re-read them. */
  markChanged(): void {
    this.atom.reportChanged();
  }
}
