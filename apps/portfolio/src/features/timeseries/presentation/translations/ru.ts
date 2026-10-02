import type { TranslationOf } from '../../../../shared/i18n/types';
import type { timeseriesTranslationsEn } from './en';

export const timeseriesTranslationsRu: TranslationOf<typeof timeseriesTranslationsEn> = {
  pageMenu: 'Страницы демо',
  pages: {
    overview: 'Обзор',
    marks: 'Типы графика',
    live: 'Живые данные',
    snapshot: 'Снимок',
    sync: 'Синхронные',
  },
  captions: {
    overview:
      'Четыре графика на одном GPU-девайсе: линия под свечами другого ряда, свечи, линия с толщиной по значению, маркеры с цветом по порогам.',
    marks:
      'Все способы рисования: площадь и ступеньки с пропуском в данных, линия и кольца из свечей, все фигуры маркеров с заливкой и обводкой разных цветов и толщин, линия с обводкой.',
    live: 'Ряд, который кончается прямо сейчас: новые элементы приходят по подписке, свеча текущего интервала растёт.',
    snapshot:
      'Обычный график с числовой осью: весь набор точек заменяется несколько раз в секунду.',
    sync: 'Два графика с общим вьюпортом; позиция под указателем на одном отмечена на другом.',
  },
  debugOverlay: {
    debug: 'Отладка',
    loadingDelay: 'Задержка загрузки',
    sourceFailures: 'Сбои источника',
    canvasOnly: 'Только Canvas 2D',
    renderers: {
      webgpu: 'WebGPU',
      canvas2d: 'Canvas 2D',
    },
  },
  live: {
    following: 'Следует за живым краем',
    history: 'Просмотр истории',
    toLiveEdge: 'К живому краю',
    styles: {
      line: 'Линия',
      stairs: 'Ступеньки',
      area: 'Площадь',
    },
  },
};
