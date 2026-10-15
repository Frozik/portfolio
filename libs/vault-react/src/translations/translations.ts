import type { IWidgetTexts } from '@frozik/vault-app/texts/widgets/widget-texts-shape';
import { WIDGET_TEXTS } from '@frozik/vault-app/texts/widgets/widgets-texts';

/** UI strings for the language of a BCP-47 tag; English for languages without a table. */
export function getVaultReactTranslations(locale: string): IWidgetTexts {
  const [language = ''] = locale.toLowerCase().split('-');
  return language === 'ru' ? WIDGET_TEXTS.ru : WIDGET_TEXTS.en;
}
