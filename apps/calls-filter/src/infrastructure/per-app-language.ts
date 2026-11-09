import type { Language } from '@frozik/utils/i18n/language';
import { isLanguage } from '@frozik/utils/i18n/language';
import { pickLanguage } from '@frozik/utils/i18n/pick-language';

import { CALL_SCREENING } from '../../modules/call-screening/src/CallScreeningModule';
import type { IAppLanguage } from '../contexts/device/domain/ports/app-language';
import type { TLanguageChoice } from '../contexts/device/domain/preferences';

function primary(tag: string): string | undefined {
  return tag.split('-')[0]?.toLowerCase();
}

/** Android's per-app language: the choice lives there, so the service's notifications follow it. */
export const PER_APP_LANGUAGE: IAppLanguage = {
  choice(): TLanguageChoice {
    const tag = CALL_SCREENING.appLanguage();
    const language = tag === null ? undefined : primary(tag);
    return isLanguage(language) ? { kind: 'fixed', language } : { kind: 'system' };
  },
  setChoice(choice) {
    CALL_SCREENING.setAppLanguage(choice.kind === 'fixed' ? choice.language : null);
  },
  systemLanguages: () => CALL_SCREENING.systemLanguages(),
  resolved(): Language {
    const choice = this.choice();
    return choice.kind === 'fixed' ? choice.language : pickLanguage(this.systemLanguages());
  },
  regionHint() {
    const [first] = CALL_SCREENING.systemLanguages();
    const region = first?.split('-').find(part => /^[A-Z]{2}$/.test(part));
    return region ?? null;
  },
};
