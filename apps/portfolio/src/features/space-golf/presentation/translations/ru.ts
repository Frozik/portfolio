import type { TranslationOf } from '../../../../shared/i18n/types';
import type { spaceGolfTranslationsEn } from './en';

export const spaceGolfTranslationsRu: TranslationOf<typeof spaceGolfTranslationsEn> = {
  hud: {
    holes: (count: number): string => `${count}`,
    strokes: (total: number, current: number): string => `${total} +${current}`,
    reset: 'Начать новый мир',
    resetConfirm: 'Нажмите ещё раз: этот мир сотрётся и начнётся новый',
    following: {
      edge: 'Вернуться к шару — нажмите ещё раз в течение двух секунд, чтобы центровать его на остановке, и ещё раз, чтобы держать в центре',
      rest: 'Шар центруется при каждой остановке — нажмите ещё раз, чтобы держать его в центре всегда',
      always: 'Шар всегда в центре — нажмите ещё раз, чтобы следить за ним только у края',
    },
    overview: 'Посмотреть всё поле',
    closeUp: 'Вернуть игровой масштаб',
    meters: (distance: number): string => `${distance} м`,
    compass: (distance: number): string => `До лунки ${distance} м`,
    foresight: (level: number, max: number): string => `Предвидение: уровень ${level} из ${max}`,
    grip: (touches: number): string => `Липучка: осталось прилипаний — ${touches}`,
    scale: (meters: number): string => `Масштаб: отрезок ${meters} м`,
  },
  status: {
    loading: 'Прокладываем поле…',
  },
  help: {
    aim: 'Нажмите в любом месте и оттяните резинку: шар полетит в противоположную сторону. Прямая стена, которой он коснётся, становится полом. Два пальца, колесо или правая кнопка двигают обзор; стрелка показывает на лунку. Поле бесконечное: каждая лунка открывает следующую.',
  },
};
