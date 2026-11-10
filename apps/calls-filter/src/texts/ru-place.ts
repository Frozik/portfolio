import type { ITexts } from './texts';

/** The place editor's words, in Russian. */
export const RU_PLACE: ITexts['place'] = {
  title: 'Местоположение',
  add: 'Добавить место',
  short: 'Место',
  name: 'Название',
  namePlaceholder: 'Офис, Дом…',
  onlyAt: 'Только здесь',
  exceptAt: 'Кроме этого места',
  radius: meters => (meters < 1_000 ? `${meters} м` : `${meters / 1_000} км`),
  radiusSmall: 'Android замечает 50 м ненадёжно; надёжнее от 100 м',
  search: 'Адрес',
  find: 'Найти',
  here: 'Где я сейчас',
  hereUnknown:
    'Телефон сейчас не может определить, где он, — отметьте место на карте или найдите адрес',
  save: 'Сохранить место',
  remove: 'Удалить место',
  at: 'вы здесь',
  away: 'вы не здесь',
  unknown: 'местоположение неизвестно — место сейчас не учитывается',
};
