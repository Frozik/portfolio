import { pageLanguage } from '@frozik/utils/i18n/page-language';

/** The page's language: set on `<html lang>` before the vault's modules load, so read once. */
export const LANGUAGE = pageLanguage();
