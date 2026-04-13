import type { TranslationOf } from '../../../../shared/i18n';
import type { sudokuTranslationsEn } from './en';

export const sudokuTranslationsRu: TranslationOf<typeof sudokuTranslationsEn> = {
  difficulty: {
    easy: 'Лёгкий',
    medium: 'Средний',
    hard: 'Сложный',
    expert: 'Эксперт',
  },
};
