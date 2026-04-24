import type { TranslationOf } from '../../../../shared/i18n/types';
import type { binanceTranslationsEn } from './en';

export const binanceTranslationsRu: TranslationOf<typeof binanceTranslationsEn> = {
  status: {
    idle: 'Ожидание',
    connecting: 'Подключение…',
    connected: 'Подключено',
    reconnecting: 'Переподключение…',
    disconnected: 'Отключено',
    resyncing: 'Синхронизация стакана…',
    error: 'Ошибка подключения',
    unsupported:
      'WebGPU-устройство не поддерживает требуемые лимиты (maxTextureDimension2D ≥ 8192)',
  },
  tooltip: {
    time: 'Время',
    price: 'Цена',
    volume: 'Объём',
    side: 'Сторона',
    bid: 'Bid',
    ask: 'Ask',
    loading: 'Загрузка…',
  },
  comingSoon: 'Тепловая карта стакана Binance — скоро',
  live: {
    instrument: (instrument: string): string => `Инструмент: ${instrument}`,
    awaitingSnapshot: 'Ожидаем REST-снепшот…',
    snapshotReceived: 'REST-снепшот получен, слушаем обновления',
    totalSnapshots: (count: number): string => `Всего снепшотов получено: ${count}`,
    lastSnapshotTime: (isoTime: string): string => `Последний снепшот: ${isoTime}`,
    errorPrefix: 'Ошибка: ',
    expand: 'Показать детали',
    collapse: 'Скрыть детали',
  },
};
