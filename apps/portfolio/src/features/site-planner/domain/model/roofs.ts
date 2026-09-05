import type { Meters } from '../units';

/**
 * The shape of a pitched roof (`building-editor.md` §5, R33). Three kinds
 * cover what a загородный дом is actually built with: двускатная (gable),
 * вальмовая (hip) and односкатная (shed). Anything more — mansard, multi-gable
 * — is a composition of these over separate storeys rather than a fourth kind.
 */
export type PitchedRoofKind = 'gable' | 'hip' | 'shed';

/** Every kind, in the order the panel offers them. */
export const PITCHED_ROOF_KINDS: readonly PitchedRoofKind[] = ['gable', 'hip', 'shed'];

export function parsePitchedRoofKind(value: string): PitchedRoofKind | undefined {
  return PITCHED_ROOF_KINDS.find(kind => kind === value);
}

/**
 * The roof crowning a building. Like every other object here only the INTENT
 * is stored — kind, slope, overhang and which way the ridge runs — and the
 * geometry derives from the top storey's outline, so a storey resized or a
 * slab moved re-cuts the roof without anyone redrawing it.
 */
export interface PitchedRoof {
  readonly kind: PitchedRoofKind;
  /** Slope of every plane, in degrees from horizontal. */
  readonly pitchDegrees: number;
  /** How far the eaves reach past the wall — the свес. */
  readonly overhangMeters: Meters;
  /** Which way the ridge runs, counter-clockwise from plan east. */
  readonly ridgeDegrees: number;
}

const DEFAULT_ROOF_PITCH_DEGREES = 30;
const DEFAULT_ROOF_OVERHANG_METERS: Meters = 0.5;
/**
 * Below this a roof stops shedding: snow sits on it and most coverings are not
 * rated for it (SP 17.13330 puts the floor of ordinary tile and metal sheet at
 * 14°). It is an advisory, not a limit — a shed over a terrace may be flatter.
 */
export const MIN_SHEDDING_PITCH_DEGREES = 14;
export const MIN_ROOF_PITCH_DEGREES = 1;
export const MAX_ROOF_PITCH_DEGREES = 70;
/** How thick the roof reads as a solid — rafters, boarding and covering. */
export const ROOF_THICKNESS_METERS: Meters = 0.25;

export function createPitchedRoof({
  kind = 'gable',
  pitchDegrees = DEFAULT_ROOF_PITCH_DEGREES,
  overhangMeters = DEFAULT_ROOF_OVERHANG_METERS,
  ridgeDegrees = 0,
}: {
  readonly kind?: PitchedRoofKind;
  readonly pitchDegrees?: number;
  readonly overhangMeters?: Meters;
  readonly ridgeDegrees?: number;
} = {}): PitchedRoof {
  return { kind, pitchDegrees, overhangMeters, ridgeDegrees };
}
