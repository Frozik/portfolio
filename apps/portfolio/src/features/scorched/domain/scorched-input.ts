/** An absolute aim produced by a drag gesture, in the dial space of `aim-dial.ts` (§12.2). */
export interface DragAim {
  readonly dialDegrees: number;
  readonly power: number;
}

/** One frame's worth of aiming intent, whatever device produced it (§12). */
export interface ScorchedInput {
  /** Degrees to turn the barrel dial by; positive swings it towards the left. */
  readonly dialDelta: number;
  readonly powerDelta: number;
  /** A drag's absolute aim. It replaces the deltas of the same frame rather than adding to them. */
  readonly aimOverride: DragAim | undefined;
  readonly isFireRequested: boolean;
  readonly isWeaponCycleRequested: boolean;
}

export interface IScorchedInputSource {
  read(): ScorchedInput;
  dispose(): void;
}

export const EMPTY_INPUT: ScorchedInput = {
  dialDelta: 0,
  powerDelta: 0,
  aimOverride: undefined,
  isFireRequested: false,
  isWeaponCycleRequested: false,
};

/** The keyboard and the touch overlay are live at the same time; either one may drive a frame. */
export function mergeScorchedInputs(first: ScorchedInput, second: ScorchedInput): ScorchedInput {
  return {
    dialDelta: first.dialDelta + second.dialDelta,
    powerDelta: first.powerDelta + second.powerDelta,
    aimOverride: first.aimOverride ?? second.aimOverride,
    isFireRequested: first.isFireRequested || second.isFireRequested,
    isWeaponCycleRequested: first.isWeaponCycleRequested || second.isWeaponCycleRequested,
  };
}
