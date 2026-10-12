import type { dataTranslationsEn } from './data-en';

/** Импорт и экспорт. */
export const dataTranslationsRu: typeof dataTranslationsEn = {
  title: 'Данные',
  import: {
    title: 'Импорт',
    intro:
      'CSV паролей из Chrome, Edge, Firefox или Safari, база SafeInCloud (.db) или её XML-выгрузка, выгрузка Bitwarden (JSON или CSV), база KeePass (.kdbx), файл CXF (.json или .zip), снимок экрана с QR переноса из Google Authenticator или другое хранилище .pwv. Ничего не сохраняется до подтверждения.',
    drop: 'Выберите, перетащите или вставьте выгруженный файл',
    failures: {
      'no-qr-code': 'На этой картинке нет QR-кода.',
      unrecognized: 'Этот файл — не выгрузка, которую знает хранилище.',
      'encrypted-export':
        'Эта выгрузка Bitwarden зашифрована. Выгрузите снова в «.json» без пароля.',
      'read-only': 'Хранилище открыто только для чтения: ничего не импортировано.',
    },
    vaultPassword: 'Пароль того хранилища',
    vaultPasswordHint:
      'Хранилище открывается здесь только чтобы прочитать карточки; потом их ничего не связывает.',
    keePassPassword: 'Мастер-пароль базы KeePass',
    keePassPasswordHint:
      'База открывается здесь только чтобы прочитать записи. Если она открывается одним файлом-ключом, оставьте пароль пустым.',
    safeInCloudPassword: 'Пароль базы SafeInCloud',
    safeInCloudPasswordHint:
      'База открывается здесь только чтобы прочитать карточки. Возьмите .db из локальной базы приложения или резервной копии.',
    keyFile: 'Файл-ключ, если он у базы есть: выберите или перетащите',
    keyFileChosen: (name: string) => `Файл-ключ: ${name}`,
    keyFileRemove: 'Убрать',
    open: 'Открыть',
    opening: 'Открываю…',
    sources: {
      chrome: 'Chrome или Edge',
      firefox: 'Firefox',
      safari: 'Safari',
      bitwarden: 'Bitwarden',
      safeincloud: 'SafeInCloud',
      cxf: 'Credential Exchange Format (CXF)',
      keepass: 'KeePass',
      authenticator: 'Google Authenticator',
      pwv: 'Другое хранилище',
    },
    found: (source: string, count: number) => `${source}: записей — ${count}.`,
    duplicates: (count: number) => `Уже есть здесь (тот же сайт и логин): ${count}.`,
    duplicateChoices: {
      skip: 'Пропустить их',
      replace: 'Заменить карточки (старые версии останутся в истории)',
      'keep-both': 'Оставить обе',
    },
    warnings: {
      'row-skipped': (row: number) => `Строка ${row} не читается и пропущена.`,
      'field-dropped': (card: string, label: string) =>
        `«${card}»: связанному полю «${label}» здесь нет соответствия.`,
      'passkey-dropped': (card: string) =>
        `«${card}»: ключ доступа (passkey) остаётся в Bitwarden.`,
      'file-dropped': (card: string, name: string) =>
        `«${card}»: вложение ${name === '' ? '(картинка)' : `«${name}»`} не переносится — прикрепите его заново.`,
      'item-skipped': (title: string) => `«${title}» — такого вида записей в хранилище нет.`,
    },
    confirm: 'Импортировать',
    importing: 'Импортирую…',
    cancel: 'Отмена',
    done: (added: number, replaced: number, skipped: number) =>
      `Импортировано: новых — ${added}, заменено — ${replaced}, пропущено — ${skipped}.`,
    filesDropped: (count: number) =>
      `Файлов не поместилось в лимит хранилища 5 МБ: ${count}; их поля пришли пустыми.`,
    another: 'Импортировать другой файл',
  },
  export: {
    title: 'Экспорт',
    formats: {
      pwv: 'Зашифрованная копия (.pwv) со своим паролем',
      zip: 'Открытый архив (.zip): всё, вместе с файлами',
      cxf: 'Credential Exchange Format (.cxf.zip) для других менеджеров паролей',
      csv: 'CSV для других менеджеров паролей (колонки Bitwarden)',
    },
    descriptions: {
      pwv: 'Отдельное хранилище с новым ключом: его можно отдать или хранить отдельно. Оно не раскрывает мастер-пароль и не синхронизируется с этим хранилищем.',
      zip: 'Содержимое хранилища в JSON и файлы каждой карточки — открывается любым архиватором.',
      cxf: 'Формат FIDO Alliance: логины, карты, Wi-Fi, документы, одноразовые коды, группы, связи и файлы. Не зашифрован.',
      csv: 'Аккаунты — как логины, остальные карточки — как заметки со своими полями. Файлы не входят.',
    },
    exportPassword: 'Пароль копии',
    exportPasswordHint: (min: number) =>
      `Не короче ${min} символов; он понадобится, чтобы открыть копию.`,
    confirmation: 'Повторите пароль',
    masterPassword: 'Мастер-пароль',
    masterPasswordHint: 'Спрашиваем снова: файл не будет зашифрован.',
    acknowledgement:
      'Понимаю, что файл не зашифрован: любой, у кого он окажется, прочитает все пароли.',
    problems: {
      'too-short': (min: number) => `Пароль должен быть не короче ${min} символов.`,
      mismatch: 'Пароли не совпадают.',
      'not-acknowledged': 'Подтвердите, что понимаете: файл не зашифрован.',
      'no-password': 'Введите мастер-пароль.',
    },
    prepare: 'Подготовить файл',
    preparing: 'Готовлю…',
    save: (name: string) => `Сохранить ${name}`,
    missingFiles: (count: number) =>
      `Файлов нет ни на этом устройстве, ни в облаке, в архив они не попали: ${count}.`,
    saved: 'Сохранено.',
    again: 'Экспортировать снова',
  },
};
