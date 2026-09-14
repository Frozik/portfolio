import type { TranslationOf } from '../../../../shared/i18n/types';
import type { spaceGolfTranslationsEn } from './en';

export const spaceGolfTranslationsRu: TranslationOf<typeof spaceGolfTranslationsEn> = {
  hud: {
    level: (number: number): string => `Уровень ${number}`,
    strokes: (total: number, current: number): string => `${total} +${current}`,
    restart: 'Начать уровень заново',
    previous: 'Предыдущий уровень',
    next: 'Следующий уровень',
  },
  status: {
    loading: 'Строим поле…',
  },
  complete: {
    title: 'В лунке!',
    strokes: (strokes: number): string => `${strokes} удар(ов)`,
    again: 'Сыграть ещё раз',
  },
  help: {
    aim: 'Нажмите в любом месте и оттяните резинку: шар полетит в противоположную сторону. Прямая стена, которой он коснётся, становится полом. Поле открытое: шар, улетевший за него без возврата, взрывается.',
  },
};
