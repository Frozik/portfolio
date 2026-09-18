import type { TranslationOf } from '../../../../shared/i18n/types';
import type { spaceGolfTranslationsEn } from './en';

export const spaceGolfTranslationsRu: TranslationOf<typeof spaceGolfTranslationsEn> = {
  hud: {
    holes: (count: number): string => `${count}`,
    strokes: (total: number, current: number): string => `${total} +${current}`,
    reset: 'Начать новый мир',
    resetConfirm: 'Нажмите ещё раз: этот мир сотрётся и начнётся новый',
    toBall: 'Вернуться к шару',
    overview: 'Посмотреть всё поле',
    closeUp: 'Вернуть игровой масштаб',
    meters: (distance: number): string => `${distance} м`,
    compass: (distance: number): string => `До лунки ${distance} м`,
    scale: (meters: number): string => `Масштаб: отрезок ${meters} м`,
  },
  status: {
    loading: 'Прокладываем поле…',
  },
  help: {
    aim: 'Нажмите в любом месте и оттяните резинку: шар полетит в противоположную сторону. Прямая стена, которой он коснётся, становится полом. Два пальца, колесо или правая кнопка двигают обзор; стрелка показывает на лунку. Поле бесконечное: каждая лунка открывает следующую.',
  },
};
