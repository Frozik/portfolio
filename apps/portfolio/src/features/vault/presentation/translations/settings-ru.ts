import type { TranslationOf } from '../../../../shared/i18n/types';
import type { settingsTranslationsEn } from './settings-en';

/** Страница настроек. */
export const settingsTranslationsRu: TranslationOf<typeof settingsTranslationsEn> = {
  open: 'Настройки',
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
