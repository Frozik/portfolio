import type { TranslationOf } from '../../../../shared/i18n/types';
import type { settingsTranslationsEn } from './settings-en';

/** Страница настроек. */
export const settingsTranslationsRu: TranslationOf<typeof settingsTranslationsEn> = {
  open: 'Настройки',
  backups: {
    title: 'Резервные копии на этом устройстве',
    intro:
      'Прежние версии хранилища, зашифрованные его ключом: сохраняются перед приходом изменений с других устройств, перед откатом и раз в час, пока вы редактируете.',
    kept: 'Хранить',
    keptCount: (count: number) => `${count} копий`,
    none: 'Копий пока нет.',
    reasons: {
      'before-sync': 'перед синхронизацией',
      periodic: 'во время правок',
      'before-restore': 'перед откатом',
    },
    restore: 'Откатить',
    restoreTitle: (when: string) => `Откатить хранилище к ${when}?`,
    restoreMessage:
      'Изменённые карточки получат тогдашнюю версию, текущая останется в истории карточки. Карточки, созданные позже, уйдут в корзину, удалённые с тех пор — вернутся. Сначала текущее состояние сохранится копией, так что откат можно отменить. Другие устройства получат откат при следующей синхронизации.',
    restored: (restored: number, revived: number, trashed: number) =>
      `Откат выполнен: восстановлено карточек — ${restored}, возвращено — ${revived}, в корзину — ${trashed}.`,
    olderKey: 'Эта копия сделана до смены ключа хранилища и больше не открывается.',
    unreadable: 'Эту копию не удалось прочитать.',
  },
  title: 'Настройки',
  back: 'К хранилищу',
  security: 'Безопасность на этом устройстве',
  idleLock: 'Блокировать после простоя',
  hiddenLock: 'Блокировать, когда вкладка в фоне',
  clipboardClear: 'Очищать скопированный секрет через',
  siteIcons: 'Иконки сайтов',
  siteIconsToggle: 'Загружать иконку каждого сайта',
  siteIconsNote:
    'Сервис иконок узнаёт домен сайта один раз; иконка хранится в хранилище и синхронизируется. Выключено — у карточек встроенные иконки.',
  clipboardNote:
    'Страница не может прочитать буфер обмена, поэтому очищает его, что бы там к тому времени ни было. Программы истории буфера видят скопированное.',
  minutes: (count: number) => `${count} мин`,
  hours: (count: number) => `${count} ч`,
  seconds: (count: number) => `${count} с`,
  atOnce: 'Сразу',
  never: 'Никогда',
  vault: 'Это хранилище',
  name: 'Название',
  rename: 'Переименовать',
  description: 'Описание',
  descriptionHint:
    'Видно в списке хранилищ на этом устройстве ещё до ввода пароля, как и название. Не пишите сюда секретов.',
  saveTitle: 'Сохранить',
  forget: 'Удалить хранилище с этого устройства',
  forgetTitle: 'Удалить хранилище с этого устройства?',
  forgetMessage:
    'Его копия в этом браузере и всё, что устройство о нём знает, будут удалены. Хранилище, которое есть только здесь, пропадёт навсегда.',
  forgetConfirm: 'Удалить',
  cancel: 'Отмена',
  about: 'О программе',
  formatVersion: (version: number) => `Версия формата хранилища: ${version}`,
  credits: 'Благодарности',
  creditsList: [
    'Словарь EFF Large Wordlist для фраз — Electronic Frontier Foundation, CC BY 3.0 US',
    'Адреса смены пароля и общие входы — apple/password-manager-resources, MIT',
    'Оценка стойкости пароля — zxcvbn-ts, MIT',
    'Argon2id — hash-wasm, MIT',
  ],
};
