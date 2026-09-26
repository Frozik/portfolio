import type { TranslationOf } from '../../../../shared/i18n/types';
import type { osmMapTranslationsEn } from './en';

export const osmMapTranslationsRu: TranslationOf<typeof osmMapTranslationsEn> = {
  hud: {
    zoom: (zoom: number): string => `z ${zoom.toFixed(2)}`,
    pitch: (degrees: number): string => `наклон ${degrees.toFixed(0)}°`,
    bearing: (degrees: number): string => `азимут ${degrees.toFixed(0)}°`,
    tiles: (visible: number, loading: number): string =>
      loading > 0 ? `тайлов ${visible}, грузится ${loading}` : `тайлов ${visible}`,
    atlas: (used: number, capacity: number): string => `атлас ${used}/${capacity}`,
    cached: (count: number): string => `на диске ${count}`,
    buildings: (tiles: number, loading: number): string =>
      loading > 0 ? `здания: тайлов ${tiles}, грузится ${loading}` : `здания: тайлов ${tiles}`,
    cars: (count: number): string => `машин ${count}`,
    reset: 'Сбросить вид',
    locate: 'Показать, где я',
    locating: 'Определяем, где вы…',
    locateFailure: {
      denied:
        'Доступ к местоположению запрещён — разрешите его сайту в браузере и браузеру в системе.',
      unavailable: 'Браузер не смог определить позицию: система её не дала.',
      timeout: 'Позиция не пришла вовремя — попробуйте ещё раз.',
      unsupported: 'В этом браузере нет геолокации.',
    },
    compass: (bearingDeg: number): string =>
      `Север отклонён на ${Math.round(bearingDeg)}° — нажмите, чтобы направить его вверх`,
  },
  help: 'Перетаскивание — сдвиг, колесо или щипок — масштаб, правая кнопка или Ctrl+перетаскивание — поворот и наклон; два пальца наклоняют движением и поворачивают скручиванием.',
  attribution: '© участники OpenStreetMap · OpenFreeMap · © OpenMapTiles',
};
