import type { TranslationOf } from '../../../../shared/i18n/types';
import type { tanksTranslationsEn } from './en';

export const tanksTranslationsRu: TranslationOf<typeof tanksTranslationsEn> = {
  title: 'Танчики',
  subtitle: 'Battle City на WebGPU',
  start: 'Начать игру',
  resume: 'Продолжить',
  paused: 'Пауза',
  controlsHint: 'Стрелки или WASD — движение · Пробел — выстрел · Enter или Escape — пауза',
  stage: (stageNumber: number): string => `Уровень ${stageNumber}`,
  skipIntro: 'Пропустить заставку уровня',
  stageClear: (stageNumber: number): string => `Уровень ${stageNumber} пройден`,
  enemiesDestroyed: 'Уничтожено врагов',
  stagePoints: 'Очки за уровень',
  gameOver: 'Игра окончена',
  finalScore: 'Итоговый счёт',
  playAgain: 'Играть снова',
  pause: 'Пауза',
  hud: {
    enemiesLeft: 'Осталось врагов',
    lives: 'Жизни',
    stage: 'Уровень',
    score: 'Счёт',
    bestScore: 'Рекорд',
    mute: 'Выключить звук',
    unmute: 'Включить звук',
  },
  touch: {
    fire: 'Огонь',
  },
};
