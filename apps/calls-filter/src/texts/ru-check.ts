import type { ITexts } from './texts';

/** «Проверить номер», in Russian. */
export const RU_CHECK: ITexts['check'] = {
  title: 'Проверить номер',
  open: 'Проверить номер',
  number: 'Номер',
  numberPlaceholder: '+31 6 12345678',
  networkName: 'Имя от оператора, если приходит',
  hidden: 'Скрытый номер',
  hint: 'Что будет, если этот номер позвонит сейчас, — по тем же правилам, что у фильтра',
  noNumber: 'Это не номер телефона',
  contact: name => `В контактах: ${name}`,
  conflict: groups => `Подходит и в ${groups} — конфликт: отвечает более мягкая группа`,
};
