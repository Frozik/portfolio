import type { DialAim } from '../../domain/aim-dial';
import type { PlayerColor } from '../../presentation/player-colors';

export type TurretStyle = 'angular' | 'box' | 'rounded';

/** A generated tank: chassis with tracks, a turret that turns with the aim, a gun that tilts. */
export interface ITankBlueprint {
  readonly hullLengthWu: number;
  readonly hullHeightWu: number;
  readonly trackHeightWu: number;
  readonly wheelCount: number;
  readonly turretStyle: TurretStyle;
  readonly turretWidthWu: number;
  readonly turretHeightWu: number;
  readonly gunLengthWu: number;
  readonly gunThicknessWu: number;
  readonly hasMuzzleBrake: boolean;
  readonly hasAntenna: boolean;
}

export interface ITankPose {
  readonly centerXWu: number;
  readonly baseYWu: number;
  readonly aim: DialAim;
  readonly color: PlayerColor;
}
