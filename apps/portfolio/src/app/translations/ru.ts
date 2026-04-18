import type { TranslationOf } from '../../shared/i18n';
import type { appTranslationsEn } from './en';

export const appTranslationsRu: TranslationOf<typeof appTranslationsEn> = {
  appTitle: 'Портфолио',
  pageTitles: {
    cv: 'Резюме',
    pendulum: 'Маятник',
    sudoku: 'Судоку',
    sun: 'Солнце',
    graphics: 'Графика',
    timeseries: 'Таймсерии',
    binance: 'Стакан Binance',
    stereometry: 'Стереометрия',
    controls: 'Элементы управления',
  },
  navigation: {
    curriculumVitae: 'Резюме',
    sectionAI: 'ИИ',
    pendulum: 'Маятник',
    pendulumMobileWarning: 'Только десктоп',
    pendulumTooltip:
      'Генетический алгоритм эволюционирует нейронные сети для балансировки перевёрнутого маятника.',
    sectionWebGPU: 'WebGPU',
    sun: 'Солнце',
    graphics: 'Графика',
    graphicsTooltip:
      'GPU-ускоренный рендеринг фигур, линий со скруглёнными соединениями и прозрачностью — почти нулевая нагрузка на CPU и минимальная на GPU',
    timeseries: 'Таймсерии',
    timeseriesTooltip:
      'WebGPU-график таймсерий, способный отрисовывать гигабайты данных с высоким FPS при почти нулевой нагрузке на CPU',
    binance: 'Стакан Binance',
    binanceTooltip:
      'Живая тепловая карта стакана Binance spot на WebGPU: градиент зелёный→красный по объёму × цене, часовая история в IndexedDB, авто-подгон min/max на GPU',
    sectionGames: 'Игры',
    sudoku: 'Судоку',
    stereometry: 'Стереометрия',
    sectionUIUX: 'UI/UX',
    controls: 'Элементы управления',
  },
  sidebar: {
    scanToOpen: 'Сканируйте, чтобы открыть эту страницу',
  },
  errorPage: {
    statusMap: {
      404: { text: 'Не найдено', message: 'Эта страница куда-то затерялась...' },
      405: { text: 'Метод не разрешён', message: 'Здесь так нельзя!' },
      406: { text: 'Неприемлемо', message: 'Не-а, не получится.' },
      407: {
        text: 'Требуется аутентификация прокси',
        message: 'Кто вы? Представьтесь!',
      },
      408: { text: 'Таймаут запроса', message: 'Ждали слишком долго... уснули.' },
      409: { text: 'Конфликт', message: 'Что-то с чем-то не ладит.' },
      410: { text: 'Удалено', message: 'Было здесь. А теперь нет. Пуф.' },
      411: { text: 'Требуется длина', message: 'Какой длины? Вы не сказали!' },
      412: { text: 'Предусловие не выполнено', message: 'Вы забыли что-то важное.' },
      413: { text: 'Слишком большой запрос', message: 'Это слишком много!' },
      414: { text: 'URI слишком длинный', message: 'Этот URL уходит в бесконечность...' },
      415: {
        text: 'Неподдерживаемый тип медиа',
        message: 'Не могу прочитать этот формат, извините.',
      },
      416: { text: 'Диапазон не удовлетворим', message: 'Этот диапазон выходит за границы.' },
      417: { text: 'Ожидание не оправдано', message: 'Не оправдали ожиданий...' },
      418: {
        text: 'Я чайник',
        message: 'Маленький и крепкий. Вы нашли пасхалку!',
      },
    } as Record<number, { text: string; message: string }>,
    teapotHint: 'Нажмите на число, чтобы начать сначала',
    clickHint: 'Тсс... попробуйте нажать на число',
    takeMeHome: 'На главную',
  },
};
