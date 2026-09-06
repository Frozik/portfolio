import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';

import { DAMAGE_POPUP_SECONDS, TAUNT_LINE_COUNT, TAUNT_VISIBLE_SECONDS } from '../domain/constants';
import type { TauntKind } from '../domain/taunts';
import { pickTaunt } from '../domain/taunts';
import type { PlayerId, WorldEvent } from '../domain/types';

/** A floating number is either a wound or a repair; the overlay colours and signs it either way. */
export type HealthPopupKind = 'damage' | 'repair';

/** A health number floating away from the tank it happened to. */
export interface IDamagePopup {
  readonly id: number;
  readonly playerId: PlayerId;
  readonly kind: HealthPopupKind;
  readonly amount: number;
  readonly position: Vector2;
  readonly remainingSeconds: number;
}

/** A taunt bubble over a tank; the text itself is resolved from the translations. */
export interface ITauntBubble {
  readonly playerId: PlayerId;
  readonly kind: TauntKind;
  readonly lineIndex: number;
  readonly remainingSeconds: number;
}

export interface IOverlayStoreParams {
  /** Where the popup starts its drift from; undefined once the tank is off the field. */
  readonly getTankCenter: (playerId: PlayerId) => Vector2 | undefined;
  /** How chatty the roster is, straight off the advanced options. */
  readonly getTalkProbabilityPercent: () => number;
}

/**
 * The two overlays that live on wall-clock time rather than on the round: the floating
 * health numbers and the taunt bubbles. Nothing here feeds back into the world — they are pushed
 * by the events the round emits and aged off the field frame by frame.
 */
export class OverlayStore {
  damagePopups: readonly IDamagePopup[] = [];
  taunts: readonly ITauntBubble[] = [];

  private nextPopupId = 1;
  private readonly getTankCenter: (playerId: PlayerId) => Vector2 | undefined;
  private readonly getTalkProbabilityPercent: () => number;

  constructor(params: IOverlayStoreParams) {
    this.getTankCenter = params.getTankCenter;
    this.getTalkProbabilityPercent = params.getTalkProbabilityPercent;

    makeAutoObservable<OverlayStore, 'nextPopupId' | 'getTankCenter' | 'getTalkProbabilityPercent'>(
      this,
      {
        nextPopupId: false,
        getTankCenter: false,
        getTalkProbabilityPercent: false,
      },
      { autoBind: true }
    );
  }

  pushHealthPopup(playerId: PlayerId, kind: HealthPopupKind, amount: number): void {
    const position = this.getTankCenter(playerId);

    if (isNil(position)) {
      return;
    }

    this.damagePopups = [
      ...this.damagePopups,
      {
        id: this.nextPopupId++,
        playerId,
        kind,
        amount: Math.round(amount),
        position,
        remainingSeconds: DAMAGE_POPUP_SECONDS,
      },
    ];
  }

  pushTaunt(playerId: PlayerId, kind: TauntKind): void {
    const pick = pickTaunt(kind, TAUNT_LINE_COUNT, this.getTalkProbabilityPercent());

    if (isNil(pick)) {
      return;
    }

    this.taunts = [
      ...this.taunts.filter(taunt => taunt.playerId !== playerId),
      {
        playerId,
        kind: pick.kind,
        lineIndex: pick.lineIndex,
        remainingSeconds: TAUNT_VISIBLE_SECONDS,
      },
    ];
  }

  /** The events that put something on the field: wounds, repairs and the last words of the dead. */
  applyEvents(events: readonly WorldEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'tank-damaged':
          this.pushHealthPopup(event.playerId, 'damage', event.amount);
          break;
        case 'tank-repaired':
          this.pushHealthPopup(event.playerId, 'repair', event.amount);
          break;
        case 'tank-destroyed':
          this.pushTaunt(event.playerId, 'death');
          break;
        default:
          break;
      }
    }
  }

  age(elapsedSeconds: number): void {
    if (this.damagePopups.length > 0) {
      this.damagePopups = this.damagePopups
        .map(popup => ({ ...popup, remainingSeconds: popup.remainingSeconds - elapsedSeconds }))
        .filter(popup => popup.remainingSeconds > 0);
    }

    if (this.taunts.length > 0) {
      this.taunts = this.taunts
        .map(taunt => ({ ...taunt, remainingSeconds: taunt.remainingSeconds - elapsedSeconds }))
        .filter(taunt => taunt.remainingSeconds > 0);
    }
  }

  /** A round is opening: whatever was floating over the last one goes with it. */
  clear(): void {
    this.damagePopups = [];
    this.taunts = [];
  }

  dispose(): void {
    this.clear();
  }
}
