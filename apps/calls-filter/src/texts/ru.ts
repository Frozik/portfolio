import { assertNever } from '@frozik/utils/assert/assertNever';

import type { TWeekday } from '../contexts/policy/domain/schedule';
import { RU_NUMBERING } from './numbering/ru';
import { plural } from './plural';
import { RU_CHECK } from './ru-check';
import { RU_MASK } from './ru-mask';
import { RU_PLACE } from './ru-place';
import { RU_SCHEDULE } from './ru-schedule';
import { RU_SYNC } from './ru-sync';
import type { ITexts } from './texts';

const count = (value: number, one: string, few: string, many: string) =>
  plural('ru', value, { one: `# ${one}`, few: `# ${few}`, many: `# ${many}`, other: `# ${many}` });

const WEEKDAYS: Readonly<Record<TWeekday, string>> = {
  1: 'пн',
  2: 'вт',
  3: 'ср',
  4: 'чт',
  5: 'пт',
  6: 'сб',
  7: 'вс',
};
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export const RU: ITexts = {
  tabs: { groups: 'Группы', calls: 'Звонки', settings: 'Настройки' },
  common: {
    save: 'Сохранить',
    cancel: 'Отмена',
    done: 'Готово',
    undo: 'Отменить',
    delete: 'Удалить',
    add: 'Добавить',
    back: 'Назад',
    more: 'Ещё',
    copy: 'Скопировать',
    today: 'Сегодня',
    yesterday: 'Вчера',
  },
  actions: { block: 'Блокировать', pass: 'Пропускать' },
  verdicts: {
    passed: 'пропущен',
    rejected: 'отклонён',
    'awaiting-repeat': 'отклонён, ждём повтора',
    'passed-as-repeat': 'пропущен как повторный',
    paused: 'пропущен, фильтр на паузе',
  },
  groups: {
    title: 'Группы',
    filterOn: 'Фильтр работает',
    pausedUntil: time => `На паузе до ${time}`,
    pinned: 'Встроенная группа: её нельзя переименовать или удалить',
    resume: 'Продолжить',
    pause: 'Пауза',
    newGroup: 'Группа',
    myContacts: 'Мои контакты',
    strangers: 'Незнакомые',
    createFirst: 'Создайте группу, чтобы разложить звонки',
    roleMissing: 'Calls Filter пока не может проверять звонки',
    roleButton: 'Разрешить',
    conflicts: value => `⚠ ${count(value, 'конфликт', 'конфликта', 'конфликтов')}`,
    now: (action, until) =>
      `${action === 'block' ? 'Блок' : 'Пропуск'} ${until === null ? 'всегда' : `до ${until}`}`,
    thenSeparator: ', ',
    next: action => `потом ${action === 'block' ? 'блок' : 'пропуск'}`,
    callsToday: value => String(value),
  },
  temporary: {
    title: action => (action === 'block' ? 'Блокировать на время' : 'Пропускать на время'),
    usually: (group, phrase) => `${group}. Обычно: ${phrase}`,
    what: 'На время',
    short: 'Временно',
    forHow: 'На',
    hour: '1 ч',
    evening: 'До вечера',
    days: value => count(value, 'день', 'дня', 'дней'),
    firstCall: 'До первого звонка',
    endOfEvent: 'До конца встречи',
    backToUsual: 'Вернуть как обычно',
    active: (action, until) => `${action} до ${until}`,
  },
  repeat: {
    title: 'Повторный звонок проходит',
    short: 'Повтор',
    groupHint: minutes =>
      `Когда группа блокирует, второй звонок в течение ${count(minutes, 'минуты', 'минут', 'минут')} проходит`,
    filterHint: 'Для всех групп, которые блокируют, — как если бы у каждой он был включён',
    hiddenMiss:
      'Скрытые номера попадают в эту группу, а по скрытому номеру не понять, что звонят повторно: такие звонки по-прежнему отклоняются',
    off: 'Выключено',
    always: 'Постоянно',
    until: moment => `До ${moment}`,
    hours: value => count(value, 'час', 'часа', 'часов'),
    days: value => count(value, 'день', 'дня', 'дней'),
    untilDate: 'До даты…',
  },
  pause: {
    title: 'Пауза всего фильтра',
    hours: value => count(value, 'час', 'часа', 'часов'),
    days: value => count(value, 'день', 'дня', 'дней'),
    weeks: value => count(value, 'неделя', 'недели', 'недель'),
    untilTomorrow: 'До завтра',
  },
  group: {
    calls: 'Звонки',
    rules: 'Правила',
    noCalls: 'Звонков пока нет',
    who: 'Кто',
    include: 'Включить',
    exclude: 'Исключить',
    addMask: 'Добавить маску: номер или название',
    addNameMask: '+ Название',
    addContact: 'Добавить контакт',
    excludeMyContacts: 'Исключить мои контакты',
    whatToDo: 'Что делать',
    addSchedule: '+ Расписание',
    schedule: 'Расписание',
    calendars: 'Календари',
    addCalendars: '+ Календари',
    noSchedule: 'всё время',
    repeatWindow: minutes =>
      `Повтор считается в течение ${count(minutes, 'минуты', 'минут', 'минут')}`,
    autoReply: 'SMS-ответ контактам',
    smsShort: 'SMS',
    autoReplyHint:
      'Уходит контакту, которого группа отклонила, не чаще раза за встречу; в роуминге — никогда',
    name: 'Название',
    color: 'Цвет',
    colorThemed: 'Основные — с оттенком для светлой и тёмной темы',
    colorPalette: 'Любой цвет — ведите пальцем по квадрату и полосе',
    colorHex: 'HEX, например FF8800',
    colorChange: 'Изменить цвет',
    colorMore: 'Другие цвета',
    deleteGroup: 'Удалить группу',
    myContactsWho: 'Включить: все мои контакты',
    myContactsHint: 'Контакты, которых вы добавили в другие группы, исключаются отсюда сами',
    strangersWho:
      'Сюда автоматически попадают звонки, которые не подошли ни под одну группу ни по номеру, ни по названию',
    memberNote: note => note,
    rename: 'Переименовать',
    specialTitle: 'Также включить',
    emptySide: 'Пока никого',
    special: {
      hidden: 'Скрытые номера',
      foreign: 'Иностранные',
      'premium-rate': 'Платные',
      voip: 'VoIP',
      'toll-free': 'Бесплатные',
    },
    specialHint: {
      hidden: 'Звонки, которые скрывают номер',
      foreign: 'Номера другой страны — не той, в чьей сети вы сейчас',
      'premium-rate': 'Платные номера по плану нумерации страны: перезвонить на них стоит дороже',
      voip: 'Номера интернет-телефонии — их любят роботы-обзвонщики',
      'toll-free':
        'Бесплатные номера по плану нумерации страны — 0800 в Нидерландах, 8 800 в России, 1-800 в США; часто колл-центры',
    },
    nameField: { network: 'имя от оператора', contact: 'имя контакта', any: 'любое имя' },
    excludedFor: group => `перенесён в «${group}»`,
  },
  call: {
    fromOperator: 'от оператора',
    fromDialer: 'по данным «Телефона»',
    hidden: 'Скрытый номер',
    move: 'В группу…',
    moveTitle: 'Перенести в группу',
    byNumber: 'По номеру',
    byName: 'По названию',
    newGroup: '+ Новая группа',
    remove: 'Убрать из группы',
    callBack: 'Перезвонить',
    openContact: 'Открыть контакт',
    fromHistory: 'из истории телефона',
    similar: 'Похожие — в маску…',
    why: (group, verdict) => `«${group}»: ${verdict}`,
    inSeveral: groups => `В нескольких группах: ${groups}`,
    addHidden: 'Добавить «Скрытые номера» в группу…',
    calls: value => (value > 1 ? `×${value}` : ''),
  },
  mask: RU_MASK,
  conflict: {
    title: 'Конфликты',
    between: groups => `${groups} берут одних и тех же звонящих`,
    example: text => `Например ${text}`,
    knownCalls: value => `${count(value, 'звонок', 'звонка', 'звонков')} в журнале`,
    keepIn: group => `Оставить в «${group}»`,
    keepKnownIn: group => `Только звонки из журнала — в «${group}»`,
    none: 'Конфликтов нет: каждый звонящий в одной группе',
  },
  changes: {
    event: (event, name) => {
      switch (event.kind) {
        case 'member-added':
          return `Добавлено в «${name(event.group)}»`;
        case 'excluded':
          return `Исключено из «${name(event.group)}»`;
        case 'member-removed':
          return `Убрано из «${name(event.group)}»`;
        case 'exclusion-removed':
          return `Снова в «${name(event.group)}»`;
        case 'my-contacts-excluded':
          return `«${name(event.group)}» теперь исключает мои контакты`;
        case 'group-created':
          return `Группа «${name(event.group)}» создана`;
        case 'group-deleted':
          return 'Группа удалена';
        case 'group-changed':
          return null;
        default:
          return assertNever(event);
      }
    },
    rejected: reason => {
      switch (reason) {
        case 'not-a-group-of-the-user':
          return 'Это можно только в своих группах';
        case 'strangers-take-nobody':
          return 'В «Незнакомые» звонки попадают сами';
        case 'nothing-to-move':
          return 'У звонка нет ни номера, ни имени';
        case 'not-a-contact':
          return 'В «Мои контакты» — только контакты';
        case 'unknown-group':
          return 'Группы больше нет';
        default:
          return assertNever(reason);
      }
    },
  },
  schedule: RU_SCHEDULE,
  phrase: {
    always: action => `${action} всегда`,
    scheduled: (action, when, otherwise) =>
      `${action} ${when}; в остальное время ${otherwise.toLowerCase()}`,
    allDay: 'весь день',
    everyDay: 'каждый день',
    onWeekdays: 'по будням',
    onWeekends: 'по выходным',
    onDays: days => `по ${days}`,
    everyN: (value, unit) => {
      switch (unit) {
        case 'day':
          return `каждые ${count(value, 'день', 'дня', 'дней')}`;
        case 'week':
          return `каждые ${count(value, 'неделю', 'недели', 'недель')}`;
        case 'month':
          return `каждые ${count(value, 'месяц', 'месяца', 'месяцев')}`;
        case 'year':
          return `каждые ${count(value, 'год', 'года', 'лет')}`;
        default:
          return assertNever(unit);
      }
    },
    monthly: 'ежемесячно',
    yearly: 'ежегодно',
    once: date => date,
    exceptEvents: calendars => `кроме ${calendars}`,
    onlyDuringEvents: calendars => `только во время ${calendars}`,
    allTheTime: 'всё время',
    onlyAtPlaces: places => `только: ${places}`,
    exceptAtPlaces: places => `кроме: ${places}`,
    onClockOf: city => `(время: ${city})`,
    localTime: '(местное время)',
  },
  calendars: {
    title: 'Календари',
    useOff: 'Выкл',
    useOnly: 'События',
    useExcept: 'Вне событий',
    unknownCalendar: 'удалённый календарь',
    noPermission: 'Разрешите доступ к календарю, чтобы правило видело ваши встречи',
    grant: 'Разрешить',
    ics: 'iCal-ссылки',
    addIcs: 'Добавить iCal-ссылку',
    icsName: 'Название',
    icsUrl: 'Ссылка (https://… .ics)',
    whereToGet:
      'Google Календарь: Настройки → календарь → «Закрытый адрес в формате iCal». Outlook: Параметры → Календарь → Общие календари → Опубликовать.',
    skipDeclined: 'Не считать отклонённые приглашения',
    includeAllDay: 'Считать события на весь день',
    upcoming: 'Ближайшие события',
    none: 'На телефоне нет календарей',
    noneHint:
      'Здесь появятся календари аккаунтов Google на телефоне — или добавьте iCal-ссылку ниже. Аккаунт уже добавлен? Откройте один раз приложение Google Календарь — после этого Android синхронизирует календари.',
    addAccount: 'Добавить аккаунт Google',
    phoneCalendars: 'Календари телефона',
    updated: when => `обновлено ${when}`,
    failed: 'не обновилось',
  },
  permissionPrompt: {
    title: {
      'screening-role': 'Разрешите фильтровать звонки',
      contacts: 'Контакты',
      'call-log': 'Журнал звонков',
      'phone-state': 'Окончание звонка',
      notifications: 'Уведомления',
      calendar: 'Календарь',
      sms: 'SMS',
      location: 'Местоположение',
      'background-location': 'Местоположение всегда',
    },
    why: {
      'screening-role':
        'Android передаёт входящие звонки только приложению, выбранному для определения номера и защиты от спама. Пока это не так, ничего не фильтруется.',
      contacts:
        'Чтобы знать, кто вам звонит: «Мои контакты», выбор контакта, и чтобы звонки от контактов вообще доходили до фильтра.',
      'call-log':
        'Чтобы заполнить «Незнакомые» из журнала телефона, включая звонки до установки приложения.',
      'phone-state': 'Чтобы спросить «Куда этот номер?», когда звонок незнакомого закончится.',
      notifications: 'Для паузы, вопроса «Куда этот номер?» и сообщений о проблемах.',
      calendar: 'Группа учитывает ваши встречи — для этого приложение читает календари телефона.',
      sms: 'Группа отвечает по SMS контактам, звонки которых отклонила.',
      location:
        'Чтобы знать, в месте ли вы, где действует группа, — только для мест, которые вы задали.',
      'background-location':
        'Android сообщает приложению о входе в место и выходе из него, даже когда оно закрыто, — выберите «Разрешить всегда».',
    },
    allow: 'Разрешить',
    openSettings: 'Открыть настройки',
    inSettings: what =>
      `Android больше не спрашивает сам. В настройках разрешите «${what}» — приложение заметит, когда вы вернётесь.`,
    roleInSettings:
      'Android больше не спрашивает сам. В настройках → Приложения по умолчанию → Определитель номера и спам выберите «Фильтр звонков» — приложение заметит, когда вы вернётесь.',
    later: 'Позже',
  },
  place: RU_PLACE,
  check: RU_CHECK,
  sync: RU_SYNC,
  settings: {
    title: 'Настройки',
    screening: 'Проверка звонков',
    role: 'Проверять звонки',
    roleOn: 'Включено',
    roleOff: 'Выключено',
    permission: {
      contacts: 'Контакты',
      calendar: 'Календарь',
      'call-log': 'Журнал звонков',
      notifications: 'Уведомления',
      'phone-state': 'Конец звонка',
      sms: 'SMS-ответ',
      location: 'Местоположение',
      'background-location': 'Местоположение всегда',
    },
    granted: 'Разрешено',
    grant: 'Разрешить',
    language: 'Язык',
    languageSystem: 'Как в системе',
    theme: 'Тема',
    themeSystem: 'Как в системе',
    themeLight: 'Светлая',
    themeDark: 'Тёмная',
    calendars: 'Календари',
    diagnostics: 'Диагностика',
    askWhereTo: 'Спрашивать «Куда этот номер?» после звонка',
    about: 'О приложении',
  },
  diagnostics: {
    title: 'Диагностика',
    shown: 'Показывать',
    journal: 'Хранить журнал звонков',
    journalDays: days => count(days, 'день', 'дня', 'дней'),
    share: 'Поделиться',
    copy: 'Скопировать',
    copied: 'Скопировано',
    all: 'Все',
    errors: 'Проблемы',
    empty: 'Пока ничего не записано',
    summary: 'Сводка',
    rulesetPublished: when => `Правила опубликованы ${when}`,
  },
  newGroup: {
    title: 'Новая группа',
    name: 'Название',
    placeholder: 'Спам, Доставка, Работа…',
    action: 'Что делать с её звонками',
    create: 'Создать',
  },
  format: {
    time: (hour, minute) => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    dayMonth: (day, month) => `${day} ${MONTHS[month - 1] ?? ''}`,
    weekdayShort: weekday => WEEKDAYS[weekday],
  },
  numbering: RU_NUMBERING,
};
