import { resolveTranslation } from '../../../../shared/i18n';
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
  INavSectionTranslation,
  IProjectTranslation,
  ISkillGroupTranslation,
} from './en';
