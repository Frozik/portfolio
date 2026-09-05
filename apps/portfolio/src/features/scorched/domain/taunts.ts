import { random } from 'lodash-es';

import { MAX_TALK_PROBABILITY_PERCENT, MIN_TALK_PROBABILITY_PERCENT } from './constants';

/** [MANUAL §12] Tanks talk when they shoot and when they die; nothing else. */
export type TauntKind = 'attack' | 'death';

export interface TauntPick {
  readonly kind: TauntKind;
  /** Index into the caller's line list — the lines themselves are translated text. */
  readonly lineIndex: number;
}

/**
 * [MANUAL §12] Talking tanks are a per-shot dice roll against the Talk Probability option, which
 * is off by default. The lines live in the feature's translations; the domain only decides
 * whether a tank speaks and which of the available lines it reaches for.
 */
export function shouldTaunt(talkProbabilityPercent: number): boolean {
  if (talkProbabilityPercent <= MIN_TALK_PROBABILITY_PERCENT) {
    return false;
  }

  return random(1, MAX_TALK_PROBABILITY_PERCENT) <= talkProbabilityPercent;
}

export function pickTaunt(
  kind: TauntKind,
  lineCount: number,
  talkProbabilityPercent: number
): TauntPick | undefined {
  if (lineCount <= 0 || !shouldTaunt(talkProbabilityPercent)) {
    return undefined;
  }

  return { kind, lineIndex: random(lineCount - 1) };
}
