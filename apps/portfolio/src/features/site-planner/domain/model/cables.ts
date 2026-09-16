/**
 * The cables a house is wired with — ВВГнг(А)-LS, the copper flat cable the
 * Russian residential norm set assumes — by section. Only what the journal
 * and the panel need: the section chooses the breaker, the outer diameter
 * fills the conduit (`wiring.md` §3.2).
 */
export type CableTypeId = 'vvg-3x1.5' | 'vvg-3x2.5' | 'vvg-3x4' | 'vvg-3x6';

export interface CableType {
  readonly id: CableTypeId;
  readonly sectionMm2: number;
  readonly outerDiameterMm: number;
  /** The breaker the section is protected by (ПУЭ табл. 1.3.4 in practice). */
  readonly breakerAmperes: number;
}

export const CABLE_TYPES: readonly CableType[] = [
  { id: 'vvg-3x1.5', sectionMm2: 1.5, outerDiameterMm: 7.6, breakerAmperes: 10 },
  { id: 'vvg-3x2.5', sectionMm2: 2.5, outerDiameterMm: 9.3, breakerAmperes: 16 },
  { id: 'vvg-3x4', sectionMm2: 4, outerDiameterMm: 10.6, breakerAmperes: 25 },
  { id: 'vvg-3x6', sectionMm2: 6, outerDiameterMm: 12.1, breakerAmperes: 32 },
];

export function cableTypeById(id: CableTypeId): CableType {
  return CABLE_TYPES.find(candidate => candidate.id === id) ?? CABLE_TYPES[1];
}

/** The cutting reserve every journal adds — 10 % is the trade's habit. */
export const CABLE_RESERVE_RATIO = 0.1;

/** The outer cross-section of one cable, what it takes of a conduit's bore. */
export function cableAreaMm2(cable: CableType): number {
  return (Math.PI * cable.outerDiameterMm ** 2) / 4;
}
