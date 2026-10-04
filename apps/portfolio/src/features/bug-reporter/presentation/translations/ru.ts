import type { bugReporterDemoTranslationsEn } from './en';

export const bugReporterDemoTranslationsRu: typeof bugReporterDemoTranslationsEn = {
  kicker: 'репорт багов / казначейский деск',
  headlinePrimary: 'Сообщить о баге',
  headlineAccent: 'не раскрыв цифры.',
  subtitle:
    'Балансы, IBAN и P&L несут класс чувствительных данных: любой скриншот и запись их скрывают. Нажмите жука в углу или Ctrl/⌘ + Shift + B.',
  panels: {
    accounts: 'Счета',
    positions: 'Позиции',
    news: 'Новости рынка',
    symptoms: 'Сломать что-нибудь',
  },
  total: 'Итого',
  columns: {
    instrument: 'Инструмент',
    side: 'Сторона',
    quantity: 'Кол-во',
    averagePrice: 'Средняя',
    lastPrice: 'Последняя',
    profit: 'P&L',
  },
  sides: { long: 'Лонг', short: 'Шорт' },
  minutesAgo: minutes => (minutes === 0 ? 'только что' : `${minutes} мин назад`),
  symptoms: {
    transfer: 'Отправить перевод',
    recalculate: 'Пересчитать портфель',
    quotes: 'Обновить котировки',
    shuffle: 'Переставить панели',
    console: 'Засыпать консоль',
  },
  symptomHints: {
    transfer: 'бросает необработанный TypeError',
    recalculate: 'блокирует главный поток на 400 мс',
    quotes: 'запрашивает несуществующий хост',
    shuffle: 'сдвигает раскладку',
    console: 'пишет 40 строк с объектами',
  },
  activity: 'Действия',
  noActivity: 'Пока ничего не нажато.',
  guide: {
    title: 'Что попадает в отчёт',
    hidden:
      'Скрыто в захвате: балансы счетов, IBAN, количества и P&L (класс bug-mask); кривая капитала целиком (класс bug-block).',
    archive:
      'В zip лежат report.md и report.json, console.txt, скриншоты с впечатанной разметкой и запись — любую секцию можно исключить перед скачиванием.',
    delivery:
      'Chromium сохраняет через системный диалог, Firefox и Safari — потоком через StreamSaver, остальные — буферизованной загрузкой.',
  },
};
