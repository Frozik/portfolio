import type { Opaque } from '@frozik/utils/types/base';

import type { Meters } from '../units';
import type { WallId } from './walls';

export type OpeningId = Opaque<'OpeningId', string>;

export type OpeningKind = 'door' | 'window';

/**
 * A door or a window, hosted by a wall (the Revit
 * convention): it lives only on its wall, slides along it, and cuts its
 * opening in every view automatically. Position is one number — the offset
 * along the wall's drawn polyline — never a free point.
 */
export interface Opening {
  readonly id: OpeningId;
  readonly wallId: WallId;
  readonly kind: OpeningKind;
  /** Centre of the opening along the wall's reference polyline. */
  readonly offsetMeters: Meters;
  readonly widthMeters: Meters;
  /** Bottom of the opening above the floor; 0 for doors and окна в пол. */
  readonly sillMeters: Meters;
  /** Top of the opening above the floor. */
  readonly headMeters: Meters;
  /**
   * Which jamb a door is hung on, looking along the wall's drawn direction,
   * and which way the leaf swings off it. Absent on windows and on doors
   * saved before swings existed — read via {@link doorSwingOf}.
   *
   * A plan without swing arcs cannot answer «will the wardrobe clear the
   * door», which is why every reference planner draws them and why a plan
   * that omits them does not read as a plan.
   */
  readonly hingeSide?: DoorHingeSide;
  readonly swing?: DoorSwing;
}

/** The jamb the leaf hangs on, along the wall's own direction. */
export type DoorHingeSide = 'start' | 'end';

/** Which side of the wall the leaf opens towards. */
export type DoorSwing = 'inward' | 'outward';

const DEFAULT_DOOR_HINGE_SIDE: DoorHingeSide = 'start';
const DEFAULT_DOOR_SWING: DoorSwing = 'inward';

/** How a door opens, defaulted for doors that predate the fields. */
export function doorSwingOf(opening: Opening): {
  readonly hingeSide: DoorHingeSide;
  readonly swing: DoorSwing;
} {
  return {
    hingeSide: opening.hingeSide ?? DEFAULT_DOOR_HINGE_SIDE,
    swing: opening.swing ?? DEFAULT_DOOR_SWING,
  };
}

/** Flips the leaf to the other jamb — the two-click convention of the market. */

/** Flips which way the door opens. */

/**
 * What the opening tool is armed with. «Окно в пол» (R21) is not a third
 * kind — it is a window whose sill starts at the floor; the preset is the
 * only thing panoramic about it.
 */
export type OpeningPreset = 'door' | 'window' | 'panoramic';

export const OPENING_PRESETS: readonly OpeningPreset[] = ['door', 'window', 'panoramic'];

export function parseOpeningPreset(value: string): OpeningPreset | undefined {
  return OPENING_PRESETS.find(preset => preset === value);
}

interface OpeningTemplate {
  readonly kind: OpeningKind;
  readonly widthMeters: Meters;
  readonly sillMeters: Meters;
  readonly headMeters: Meters;
}

/** Typical built dimensions, the defaults a placed opening starts at. */
const OPENING_TEMPLATES: Readonly<Record<OpeningPreset, OpeningTemplate>> = {
  door: { kind: 'door', widthMeters: 0.9, sillMeters: 0, headMeters: 2.1 },
  window: { kind: 'window', widthMeters: 1.2, sillMeters: 0.9, headMeters: 2.1 },
  panoramic: { kind: 'window', widthMeters: 2.4, sillMeters: 0, headMeters: 2.5 },
};

export const DEFAULT_OPENING_PRESET: OpeningPreset = 'door';

/** Mints an opening of the armed preset at that point of the wall. */
export function createOpening({
  wallId,
  preset,
  offsetMeters,
}: {
  readonly wallId: WallId;
  readonly preset: OpeningPreset;
  readonly offsetMeters: Meters;
}): Opening {
  const template = OPENING_TEMPLATES[preset];

  return {
    id: crypto.randomUUID() as OpeningId,
    wallId,
    kind: template.kind,
    offsetMeters,
    widthMeters: template.widthMeters,
    sillMeters: template.sillMeters,
    headMeters: template.headMeters,
    ...(template.kind === 'door'
      ? { hingeSide: DEFAULT_DOOR_HINGE_SIDE, swing: DEFAULT_DOOR_SWING }
      : {}),
  };
}
