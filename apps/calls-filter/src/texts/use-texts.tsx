import type { Language } from '@frozik/utils/i18n/language';
import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

import { EN } from './en';
import { RU } from './ru';
import type { ITexts } from './texts';

const CATALOGS: Readonly<Record<Language, ITexts>> = { en: EN, ru: RU };

const TextsContext = createContext<ITexts>(EN);

export function AppTexts({
  language,
  children,
}: {
  readonly language: Language;
  readonly children: ReactNode;
}) {
  return <TextsContext value={CATALOGS[language]}>{children}</TextsContext>;
}

export function useTexts(): ITexts {
  return useContext(TextsContext);
}
