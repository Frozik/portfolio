import type { TranslationOf } from '../../../../shared/i18n/types';
import type { spaceGolfTranslationsEn } from './en';

export const spaceGolfTranslationsRu: TranslationOf<typeof spaceGolfTranslationsEn> = {
  hud: {
    level: (number: number): string => `Уровень ${number}`,
    strokes: (total: number, current: number): string => `${total} +${current}`,
    par: (par: number): string => `пар ${par}`,
    pickups: (collected: number, total: number): string => `${collected}/${total}`,
    restart: 'Начать уровень заново',
  },
  status: {
    loading: 'Строим поле…',
    failed: 'Поле не построилось. Обновите страницу, чтобы попробовать снова.',
  },
  complete: {
    title: 'В лунке!',
    strokes: (strokes: number, par: number): string => `${strokes} удар(ов) · пар ${par}`,
    next: 'Следующий уровень',
    again: 'Сыграть ещё раз',
  },
  help: {
    aim: 'Нажмите в любом месте и оттяните резинку: шар полетит в противоположную сторону. Прямая стена, которой он коснётся, становится полом. Поле открытое: шар, улетевший за него на три секунды, взрывается.',
  },
};
