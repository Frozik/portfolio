import type { TranslationOf } from '../../../../shared/i18n';
import type { stereometryTranslationsEn } from './en';

export const stereometryTranslationsRu: TranslationOf<typeof stereometryTranslationsEn> = {
  toolbar: {
    undo: 'Отменить',
    redo: 'Повторить',
    rotate: 'Вращение',
    pan: 'Перемещение',
    help: 'Справка',
    close: 'Закрыть',
  },
  help: {
    title: 'Стереометрия',
    description:
      'Интерактивная 3D-игра по стереометрии — стройте вспомогательные линии, находите точки пересечения прямых и граней, выполняйте сечения фигур.',
    controls: {
      drag: 'вращение камеры',
      shiftDrag: 'перемещение вида',
      scrollPinch: 'приближение и отдаление',
      clickEdge: 'выделить ребро',
      doubleClickEdge: 'продлить ребро в бесконечную прямую',
      dragVertex: 'провести вспомогательную линию между двумя точками',
      selectEdgeTapVertex: 'провести параллельную прямую через эту вершину',
    },
    controlLabels: {
      drag: 'Перетаскивание',
      shiftDrag: 'Shift+Перетаскивание',
      scrollPinch: 'Прокрутка / Щипок',
      clickEdge: 'Клик по ребру/линии',
      doubleClickEdge: 'Двойной клик по ребру',
      dragVertex: 'Перетащить вершину \u2192 вершину',
      selectEdgeTapVertex: 'Выделить ребро + нажать на вершину',
    },
    intersectionHint: 'Точки пересечения появляются автоматически при пересечении линий.',
  },
};
