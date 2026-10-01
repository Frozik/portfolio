import type { TranslationOf } from '../../../../shared/i18n/types';
import type { sunTranslationsEn } from './en';

export const sunTranslationsRu: TranslationOf<typeof sunTranslationsEn> = {
  panel: {
    title: 'Тест видеокарты',
    restart: 'Запустить тест заново',
    copy: 'Скопировать полный отчёт',
    copied: 'Отчёт скопирован',
    copyFailed: 'Браузер не дал скопировать',
    status: {
      calibrating: 'Определяем частоту экрана…',
      searching: 'Добавляем треугольники, пока кадры не начнут пропадать…',
      finished: 'Готово: максимум треугольников без пропуска кадров',
    },
    fps: 'FPS',
    display: 'Экран',
    hertz: (rate: number): string => `${rate} Гц`,
    trying: 'Пробуем',
    holds: 'Держит',
    canvas: 'Холст',
    card: 'Видеокарта',
    acceleration: 'Ускорение',
    accelerationKind: {
      hardware: 'аппаратное',
      software: 'программное, без GPU',
      unknown: 'неизвестно',
    },
    limits: 'Лимиты',
    features: (supported: number, total: number): string => `Возможности ${supported}/${total}`,
    gpuPending: 'Запускаем WebGPU…',
    failure: {
      'no-api': 'В этом браузере нет WebGPU',
      'insecure-context': 'WebGPU нужна защищённая страница (HTTPS)',
      'no-adapter':
        'Браузер не дал адаптер WebGPU: видеокарта в чёрном списке или аппаратное ускорение выключено',
      'no-device': 'Адаптер отказался создать устройство',
      'device-lost': 'GPU-устройство потеряно',
    },
  },
};
