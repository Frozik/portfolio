import type { ITexts } from './texts';

/** The sync section's words, in Russian. */
export const RU_SYNC: ITexts['sync'] = {
  title: 'Синхронизация',
  what: 'Группы хранятся в скрытой папке вашего Google Drive и совпадают на всех подключённых телефонах. Эту папку видит только это приложение.',
  connect: 'Подключить Google Drive',
  now: 'Синхронизировать сейчас',
  disconnect: 'Отключить',
  replace: 'Заменить облачную копию копией этого телефона',
  account: account => account ?? 'Аккаунт Google',
  state: {
    off: 'Не подключено',
    syncing: 'Синхронизация…',
    synced: moment => `Синхронизировано: ${moment}`,
    offline: 'Нет сети — синхронизирую, когда появится',
    'auth-required': 'Google просит подключиться заново',
    'rate-limited': 'Google попросил подождать — попробую позже',
    server: 'Google Drive не ответил — попробую позже',
    quota: 'Google Drive заполнен',
    unreadable: 'Облачная копия не читается — её не трогали',
  },
};
