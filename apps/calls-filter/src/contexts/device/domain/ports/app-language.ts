import type { Language } from '@frozik/utils/i18n/language';

import type { TLanguageChoice } from '../preferences';

/**
 * The language of the app as Android keeps it (per-app language), so the service's
 * notifications speak it too. One owner: there is no copy in the app's own settings.
 */
export interface IAppLanguage {
  choice(): TLanguageChoice;
  setChoice(choice: TLanguageChoice): void;
  /** The phone's languages, most preferred first (BCP 47). */
  systemLanguages(): readonly string[];
  /** What «as the system» comes to; Language lists only those the app speaks. */
  resolved(): Language;
  /** The region of the phone's first language (`NL` of `nl-NL`): the home country when there is no SIM. */
  regionHint(): string | null;
}
