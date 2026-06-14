import { resolveTranslation } from '../../../../shared/i18n/translate';
import { welcomeTranslationsEn } from './en';
import { welcomeTranslationsRu } from './ru';

export const welcomeT = resolveTranslation({
  en: welcomeTranslationsEn,
  ru: welcomeTranslationsRu,
});

export type {
  IContactLabels,
  IExperienceTranslation,
  IHeroStatTranslation,
  IProjectTranslation,
  ISkillGroupTranslation,
} from './en';
