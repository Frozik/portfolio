import type { TranslationOf } from '../../../../shared/i18n/types';
import type { transportTranslationsEn } from './en';

export const transportTranslationsRu: TranslationOf<typeof transportTranslationsEn> = {
  kicker: 'transport / http3 · webtransport',
  headlinePrimary: 'Один транспорт:',
  headlineAccent: 'HTTP/3 сначала, WebSocket — когда иначе нельзя.',
  subtitle:
    'Connect RPC поверх WebTransport: JSON для сообщений, бинарный protobuf для байтов, один поток на вызов. Если UDP заблокирован, те же вызовы идут через мультиплексированный WebSocket с тем же управлением потоком.',
  connection: {
    title: 'Подключение',
    states: {
      idle: 'Ещё не подключено',
      connecting: 'Подключение…',
      open: (protocol: string) => `Открыто через ${protocol}`,
      failed: (reason: string) => `Ошибка: ${reason}`,
    },
    protocols: { http3: 'HTTP/3 (WebTransport)', websocket: 'WebSocket (запасной путь)' },
    modes: { auto: 'Авто', http3: 'Только HTTP/3', websocket: 'Только WebSocket' },
    modeHint:
      '«Авто» сначала пробует HTTP/3 и сам переходит на запасной путь; остальные режимы задают путь жёстко.',
  },
  plot: {
    title: 'График функции',
    expression: 'f(x) =',
    expressionHint:
      'Одна переменная x; + − * / ^, неявное умножение (2x, 3(x+1)), sin cos tan sqrt abs ln log exp, pi, e.',
    xMin: 'x от',
    xMax: 'до',
    submit: 'Построить',
    inputErrors: {
      'expression-empty': 'Введите функцию от x.',
      'expression-too-long': 'Слишком длинное выражение.',
      'invalid-range': 'Диапазон должен идти от меньшего x к большему.',
    },
    expressionErrors: {
      empty: 'Пустое выражение',
      'too-long': 'Слишком длинное выражение',
      'too-deep': 'Слишком много вложенных скобок',
      'unexpected-character': 'Неожиданный символ',
      'invalid-number': 'Некорректное число',
      'unknown-identifier': 'Неизвестное имя',
      'unexpected-token': 'Здесь это не ожидалось',
      'unexpected-end': 'Выражение обрывается',
      unknown: 'Сервер не смог его прочитать',
    },
    waiting: 'Запрашиваем у сервера видимое окно…',
    lastSample: (points: number, ms: number) =>
      `последнее окно: ${points} точек за ${Math.round(ms)} мс`,
    navigationHint:
      'Колесо или щипок — масштаб, перетаскивание — сдвиг: каждое новое окно сервер считает заново, одна точка на 10 физических пикселей.',
    chartLabel: 'График посчитанной функции',
  },
  echo: {
    title: 'Эхо файла',
    description:
      'Файл уходит на сервер и сразу возвращается в выбранный вами файл. Ничего не хранится: сервер держит один фрагмент за раз, а медленный диск замедляет отправку.',
    pick: 'Файл для эха',
    start: 'Запустить эхо',
    cancel: 'Отменить',
    limits: (maxBytes: string, rate: string) => `До ${maxBytes}, не быстрее ${rate}`,
    sent: 'Отправлено',
    received: 'Получено',
    speed: 'Скорость',
    strategy: {
      'file-system-access': 'сохранение через диалог файла',
      'stream-saver': 'сохранение потоковой загрузкой',
      'blob-download': 'сохранение загрузкой',
    },
    tooLarge: (size: string, limit: string) => `Файл весит ${size}, а предел — ${limit}.`,
    noStreamingSave:
      'Этот браузер умеет сохранить файл, только целиком держа его в памяти, а эхо так не делает. Попробуйте браузер на Chromium или разрешите service worker.',
    cancelled: 'Отменено.',
    results: 'Завершённые прогоны',
    columns: {
      protocol: 'Протокол',
      size: 'Объём файла',
      speed: 'Скорость',
      verdict: 'Проверка',
    },
    verdictShort: {
      intact: 'Целый',
      'size-mismatch': 'Размер не совпал',
      'checksum-mismatch': 'Байты изменились',
    },
    unknownProtocol: 'транспорт неизвестен (сессия уже оборвалась)',
  },
  failures: {
    refused: (message: string) => `Отказано: ${message}`,
    quota: (message: string) => `Превышен предел: ${message}`,
    unreachable: (message: string) => `Нет ответа: ${message}`,
  },
};
