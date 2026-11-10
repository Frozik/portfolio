import type { TAction } from '../../contexts/policy/domain/action';
import type { TScheme } from './AppTheme';

/**
 * Calm text tones for an action in a line of words: pastel on the dark background, muted on the
 * light one, where a pastel would not read on white. Buttons keep the full `danger`/`positive`.
 */
const ACTION_TONES: Readonly<Record<TAction, Readonly<Record<TScheme, string>>>> = {
  block: { light: '#b4514b', dark: '#f2a7a1' },
  pass: { light: '#3d8158', dark: '#a3d9b1' },
};

export function actionTone(action: TAction, scheme: TScheme): string {
  return ACTION_TONES[action][scheme];
}
