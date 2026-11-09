import type { Language } from '@frozik/utils/i18n/language';

import type { TRepeatPass } from '../../policy/domain/repeat-pass';
import { REPEAT_OFF } from '../../policy/domain/repeat-pass';

export type TLanguageChoice =
  | { readonly kind: 'system' }
  | { readonly kind: 'fixed'; readonly language: Language };

export type TThemeChoice = 'system' | 'light' | 'dark';

export interface IDevicePreferences {
  readonly theme: TThemeChoice;
  readonly journalDays: number;
  readonly askWhereToAfterCall: boolean;
  /** The filter-wide «a repeat rings», over every group's own. A fact of this phone. */
  readonly repeatPass: TRepeatPass;
}

const DEFAULT_JOURNAL_DAYS = 90;

export const DEFAULT_PREFERENCES: IDevicePreferences = {
  theme: 'system',
  journalDays: DEFAULT_JOURNAL_DAYS,
  askWhereToAfterCall: true,
  repeatPass: REPEAT_OFF,
};
