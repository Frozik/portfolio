import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';

import { fromDialDegrees, turnDial } from '../domain/aim-dial';
import { getMaxPower } from '../domain/ballistics';
import { MAX_POWER, PLASMA_MIN_BATTERIES } from '../domain/constants';
import type { ScorchedRound } from '../domain/round';
import { getTankCenter } from '../domain/tank-geometry';
import type {
  AimState,
  GuidanceKind,
  PlayerId,
  TankState,
  TurretFacing,
  WeaponId,
  WorldEvent,
} from '../domain/types';
import { getFallbackWeaponId, getWeapon, WEAPONS } from '../domain/weapons/catalog';
import type { WorldModel } from './WorldModel';

/** Everything armed for the next trigger pull; all of it is spent by the shot. */
export interface IShotSetup {
  readonly guidance: GuidanceKind | undefined;
  readonly hasContactTrigger: boolean;
  readonly plasmaBatteries: number;
}

export interface IAvailableWeapon {
  readonly weaponId: WeaponId;
  readonly count: number;
}

export interface IAimModelParams {
  readonly world: WorldModel;
  /** Only a human lining up their own shot may change what the shot is. */
  readonly canAct: () => boolean;
}

const DEFAULT_ELEVATION_DEGREES = 45;
const DEFAULT_FACING: TurretFacing = 'right';
const EMPTY_SHOT_SETUP: IShotSetup = {
  guidance: undefined,
  hasContactTrigger: false,
  plasmaBatteries: PLASMA_MIN_BATTERIES,
};

/** The aim the player is turning, the weapon on the rail and what is armed for the next shot. */
export class AimModel {
  selectedWeaponId: WeaponId = getFallbackWeaponId();
  shotSetup: IShotSetup = EMPTY_SHOT_SETUP;
  isWeaponCarouselOpen = false;

  private readonly world: WorldModel;
  private readonly canAct: () => boolean;
  private readonly rememberedWeapons = new Map<PlayerId, WeaponId>();

  constructor(params: IAimModelParams) {
    this.world = params.world;
    this.canAct = params.canAct;

    makeAutoObservable<AimModel, 'world' | 'canAct' | 'rememberedWeapons' | 'activeTank'>(
      this,
      { world: false, canAct: false, rememberedWeapons: false, activeTank: false },
      { autoBind: true }
    );
  }

  get elevationDegrees(): number {
    return this.activeTank?.aim.elevationDegrees ?? DEFAULT_ELEVATION_DEGREES;
  }

  get power(): number {
    return this.activeTank?.aim.power ?? 0;
  }

  get facing(): TurretFacing {
    return this.activeTank?.aim.facing ?? DEFAULT_FACING;
  }

  get maxPower(): number {
    const tank = this.activeTank;

    return isNil(tank) ? MAX_POWER : getMaxPower(tank.health);
  }

  /** What Tab walks and the carousel lists: the free baby missile plus whatever is still owned. */
  get availableWeapons(): readonly IAvailableWeapon[] {
    const round = this.world.round;
    const playerId = round.activePlayerId;

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

  selectWeapon(weaponId: WeaponId): void {
    this.selectedWeaponId = weaponId;
    this.isWeaponCarouselOpen = false;
  }

  /** Tab walks the arsenal: the free baby missile plus whatever the tank still owns. */
  cycleWeapon(): void {
    const available = this.availableWeapons.map(entry => entry.weaponId);

    if (available.length === 0) {
      return;
    }

    const currentIndex = available.indexOf(this.selectedWeaponId);

    this.selectedWeaponId = available[(currentIndex + 1) % available.length];
  }

  /** The carousel lists the active tank's locker, so it only opens for the human whose turn it is. */
  setCarouselOpen(isOpen: boolean): void {
    this.isWeaponCarouselOpen = isOpen && this.canAct();
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

  adjust(dialDelta: number, powerDelta: number): void {
    const tank = this.activeTank;

    if (isNil(tank)) {
      return;
    }

    const turned: AimState = turnDial(tank.aim, dialDelta);

    this.setAim({ ...turned, power: tank.aim.power + powerDelta });
  }

  /** A drag names the aim outright rather than nudging whatever was there before. */
  setFromDial(dialDegrees: number, power: number): void {
    if (isNil(this.activeTank)) {
      return;
    }

    this.setAim({ ...fromDialDegrees(dialDegrees), power });
  }

  setAim(aim: AimState): void {
    this.world.round.setAim(aim);
    this.world.markChanged();
  }

  /** Pulls the trigger with everything armed; the shot spends the setup and is remembered. */
  fire(): readonly WorldEvent[] {
    const round = this.world.round;
    const shooterId = round.activePlayerId;
    const events = round.fire({
      weaponId: this.selectedWeaponId,
      guidance: this.shotSetup.guidance,
      guidanceTarget: this.resolveGuidanceTarget(round),
      useContactTrigger: this.shotSetup.hasContactTrigger,
      plasmaBatteries: this.shotSetup.plasmaBatteries,
    });

    if (events.length > 0 && !isNil(shooterId)) {
      this.rememberedWeapons.set(shooterId, this.selectedWeaponId);
    }

    this.resetShot();

    return events;
  }

  /** The weapon you last fired stays selected turn to turn; an emptied locker falls back. */
  beginTurn(playerId: PlayerId): void {
    this.selectedWeaponId = this.recallWeapon(playerId);
    this.resetShot();
  }

  beginRound(): void {
    this.selectedWeaponId = getFallbackWeaponId();
    this.resetShot();
  }

  beginMatch(): void {
    this.rememberedWeapons.clear();
    this.beginRound();
  }

  private get activeTank(): TankState | undefined {
    const round = this.world.round;
    const playerId = round.activePlayerId;

    return isNil(playerId) ? undefined : round.getTank(playerId);
  }

  private recallWeapon(playerId: PlayerId): WeaponId {
    const remembered = this.rememberedWeapons.get(playerId);

    if (
      isNil(remembered) ||
      (!getWeapon(remembered).isUnlimited &&
        this.world.round.getAmmoCount(playerId, remembered) === 0)
    ) {
      return getFallbackWeaponId();
    }

    return remembered;
  }

  /**
   * [MANUAL §7] Every guidance kind needs somewhere to steer towards. The nearest living opponent
   * is used for all of them, including Lazy Boy: a free-form target pick would need a second
   * pointer gesture on top of aiming, and the manual's own point is that guidance is a crutch.
   */
  private resolveGuidanceTarget(round: ScorchedRound): Vector2 | undefined {
    const playerId = round.activePlayerId;

    if (isNil(this.shotSetup.guidance) || isNil(playerId)) {
      return undefined;
    }

    const self = round.getTank(playerId);

    if (isNil(self)) {
      return undefined;
    }

    return round.tanks
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
    this.shotSetup = EMPTY_SHOT_SETUP;
    this.isWeaponCarouselOpen = false;
  }
}
