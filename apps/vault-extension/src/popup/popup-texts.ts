import { pageLanguage } from '@frozik/utils/i18n/page-language';

import { EXTENSION_TEXTS } from '@frozik/vault-app/texts/extension/extension-texts';

/** The popup speaks the browser's language, English for languages the app does not speak. */
export const popupT = EXTENSION_TEXTS[pageLanguage()];
