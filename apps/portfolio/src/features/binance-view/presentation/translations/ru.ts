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
    tradesLabel: 'Сделки',
    tradesGated: 'Ждём стакан',
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
  tradePopup: {
    close: 'Закрыть',
    empty: 'Сделки не кэшированы',
    loading: 'Загрузка истории…',
    buy: 'ПОКУПКА',
    sell: 'ПРОДАЖА',
    summary: (volume: string, vwap: string): string => `Σ ${volume} @ ${vwap}`,
    buyShare: (percent: string): string => `Покупка ${percent}%`,
    sellShare: (percent: string): string => `Продажа ${percent}%`,
    headerAggregates: (volume: string, vwap: string, count: number): string =>
      `Σ ${volume} · vwap ${vwap} · сделок ${count}`,
  },
  comingSoon: 'Тепловая карта стакана Binance — скоро',
  live: {
    instrument: (instrument: string): string => `Инструмент: ${instrument}`,
    awaitingSnapshot: 'Ожидаем REST-снепшот…',
    snapshotReceived: 'REST-снепшот получен, слушаем обновления',
    totalSnapshots: (count: number): string => `Всего снепшотов получено: ${count}`,
    lastSnapshotTime: (isoTime: string): string => `Последний снепшот: ${isoTime}`,
    totalTrades: (count: number): string => `Всего сделок получено: ${count}`,
    lastTradeTime: (isoTime: string): string => `Последняя сделка: ${isoTime}`,
    websocketLabel: 'Websocket',
    orderbookSection: 'Стакан',
    tradesSection: 'Сделки',
    errorPrefix: 'Ошибка: ',
    openStatusDetails: 'Открыть детали статуса',
    closeStatusDetails: 'Закрыть детали статуса',
  },
};
