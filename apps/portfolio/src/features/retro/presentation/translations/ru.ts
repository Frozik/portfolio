import type { TranslationOf } from '../../../../shared/i18n';
import type { retroEnTranslations } from './en';

const RUSSIAN_TEEN_START = 11;
const RUSSIAN_TEEN_END = 19;
const RUSSIAN_FEW_END = 4;
const RUSSIAN_MOD_100_BOUNDARY = 100;
const RUSSIAN_MOD_10_BOUNDARY = 10;

function pluralizeRu(count: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(count) % RUSSIAN_MOD_100_BOUNDARY;
  const mod10 = Math.abs(count) % RUSSIAN_MOD_10_BOUNDARY;
  if (mod100 >= RUSSIAN_TEEN_START && mod100 <= RUSSIAN_TEEN_END) {
    return many;
  }
  if (mod10 === 1) {
    return one;
  }
  if (mod10 >= 2 && mod10 <= RUSSIAN_FEW_END) {
    return few;
  }
  return many;
}

export const retroRuTranslations: TranslationOf<typeof retroEnTranslations> = {
  lobby: {
    title: 'Ретро',
    subtitle: 'Совместные ретроспективы — локально, без бэкенда',
    createButton: 'Создать ретро',
    joinByLinkLabel: 'Или присоединиться к существующему ретро по ссылке',
    joinByLinkPlaceholder: 'Вставьте ссылку на ретро или ID комнаты…',
    joinSubmit: 'Присоединиться',
    emptyState: 'Ретроспектив пока нет. Создайте, чтобы начать.',
    createdAt: 'Создано',
    lastVisited: 'Последнее открытие',
    participantsSuffix: 'участников',
    deleteConfirm: 'Удалить это ретро из локального хранилища?',
    deleteButton: 'Удалить',
    ownerLabel: 'Создатель',
    youLabel: 'вы',
    deleteDialogTitle: 'Удалить «{name}»?',
    deleteDialogDescription:
      'Ретро будет удалено из вашего локального хранилища. У других участников, у которых сохранена ссылка, останется их собственная копия.',
    deleteCancel: 'Отмена',
    // Новые ключи для редизайна лобби (Stage 3 будет их использовать).
    roomsSectionKicker: 'комнаты',
    joinSectionKicker: 'присоединиться / существующая комната',
    activeRoomsLabel: 'АКТИВНЫЕ КОМНАТЫ',
    headlinePrimary: 'Совместные',
    headlineAccent: 'ретроспективы',
    noRoomsYet: 'комнат пока нет — создайте выше',
    memberSingular: 'участник',
    memberPlural: 'участников',
    membersOverflow: '+{count} участников',
    hostedBy: 'создатель',
    roomIdLabel: 'id',
    pasteLinkKicker: 'ВСТАВЬТЕ ССЫЛКУ ИЛИ ID КОМНАТЫ',
    newRetroKicker: 'НОВОЕ РЕТРО / НАЗВАНИЕ',
    startNewTitle: 'Начать новое ретро',
    startNewSubtitle: 'Откроется новая комната со ссылкой-приглашением',
    createSubmit: 'создать',
    joinSubmitShort: 'войти',
    cancelLabel: 'отмена',
    copyLinkLabel: 'скопировать ссылку',
    heroSubtitle:
      'Собирайтесь, размышляйте, действуйте. Комнаты живут локально в браузере — без аккаунтов и серверов. Поделитесь ссылкой, чтобы пригласить команду.',
    roomKicker: 'КОМНАТА',
    membersLabel: 'участников',
    activeRoomsSectionLabel: 'активные комнаты',
    createOrJoinSectionLabel: 'создать или войти',
    newRetroCardKicker: 'новое ретро',
    joinByLinkCardKicker: 'войти по ссылке',
    totalRoomsLabel: 'ВСЕГО КОМНАТ',
    ownerBadgeTitle: 'Владелец',
    completedLabel: 'ЗАВЕРШЕНО',
  },
  create: {
    dialogTitle: 'Создать новое ретро',
    dialogDescription:
      'Выберите шаблон и бюджет голосов. Ссылкой можно будет поделиться после создания.',
    nameLabel: 'Название',
    namePlaceholderFallback: 'Ретро — сегодня',
    templateLabel: 'Шаблон',
    votesLabel: 'Голосов на участника',
    submit: 'Создать',
    cancel: 'Отмена',
    kicker: 'НОВОЕ РЕТРО',
  },
  templates: {
    scrum: {
      name: 'Scrum (3 колонки)',
      description: 'Что прошло хорошо / Что улучшить / План действий — классический Agile-формат.',
    },
    madSadGlad: {
      name: 'Злой / Грустный / Радостный',
      description: 'Фокус на эмоциях. Хорошо подходит для тяжёлых спринтов.',
    },
    startStopContinue: {
      name: 'Начать / Прекратить / Продолжить',
      description: 'Простейший формат, ориентированный на действия.',
    },
  },
  identity: {
    dialogTitle: 'Как вас зовут?',
    dialogDescription: 'Это имя и цвет будут видны другим участникам комнаты.',
    nameLabel: 'Отображаемое имя',
    namePlaceholder: 'Введите ваше имя',
    colorLabel: 'Цвет',
    submit: 'Продолжить',
    lobbyLabel: 'Вы',
    editButton: 'Изменить',
    setButton: 'Задать имя',
    unsetPlaceholder: 'Имя ещё не задано',
    kicker: 'ИДЕНТИЧНОСТЬ',
  },
  room: {
    copyLink: 'Скопировать ссылку',
    linkCopied: 'Ссылка скопирована в буфер обмена',
    waitingForPeers: 'Ожидаем участников…',
    offlineBanner:
      'Другие участники не в сети. Ваши изменения синхронизируются, когда они подключатся.',
    facilitatorBadge: 'Владелец',
    facilitatorOffline: 'Владелец не в сети.',
    takeOver: 'Принять роль',
    participantsLabel: 'Участники',
    addCardPlaceholder: 'Напишите карточку…',
    addCardSubmit: 'Добавить',
    cardBackLabel: 'Скрыто до раскрытия',
    someoneIsWriting: 'Кто-то пишет…',
    multipleWriting: 'пишут…',
    editCard: 'Редактировать',
    deleteCard: 'Удалить',
    saveCard: 'Сохранить',
    cancelEdit: 'Отмена',
    groupLabel: 'Группа',
    // Новые ключи для редизайна комнаты (Stage 3 будет их использовать).
    cardsVotesKicker: 'КАРТОЧКИ / ГОЛОСА',
    totalCardsKicker: 'ВСЕГО КАРТОЧЕК',
    phaseKicker: 'ФАЗА',
    yourVotesKicker: 'ВАШИ ГОЛОСА',
    columnKicker: 'КОЛОНКА',
    onlineLabel: 'в сети',
    copyShareLink: 'Скопировать ссылку',
    postSubmit: 'добавить',
    writeCardPrompt: 'Напишите карточку — поделитесь мыслями…',
    charsSuffix: 'симв.',
    noCardsYet: 'карточек пока нет',
    autosavingFooter: 'локальное автосохранение',
    roomPrefix: 'комната',
    hostedBy: 'создатель',
    // Новые ключи для редизайна комнаты (Stage 4 — sticky top bar, пресенс, степпер).
    backToLobbyLabel: 'Назад к списку',
    membersOverflow: '+{count} участников',
    shareLinkTitle: 'Поделиться этим ретро',
    viewResultsTitle: 'Показать результаты',
    takeOverHint: 'Принять роль владельца',
    // Новые ключи для редизайна доски (Stage 5 — колонки, карточки, форма добавления, голосование).
    cardsLabel: 'карточек',
    votesLabel: 'голосов',
    cardIndexUnknown: '???',
    cardHiddenSummary: '{index} / {placeholder}',
  },
  phases: {
    brainstorm: 'Мозговой штурм',
    group: 'Группировка',
    vote: 'Голосование',
    discuss: 'Обсуждение',
    close: 'Завершение',
    nextPhase: 'Следующая фаза',
    prevPhase: 'Предыдущая фаза',
    hintBrainstorm: 'Напишите карточки самостоятельно — что важно озвучить.',
    hintGroup: 'Сгруппируйте близкие карточки вместе.',
    hintVote: (remaining: number, total: number) => `Осталось ${remaining} из ${total} голосов.`,
    hintDiscuss: 'Обсудите кластеры с наибольшим числом голосов.',
    hintClose: 'Закрепите план действий и ответственных.',
  },
  timer: {
    start: 'Старт',
    pause: 'Пауза',
    resume: 'Продолжить',
    reset: 'Сбросить',
    addTwoMin: '+2 мин',
    decrease: 'Уменьшить таймер',
    increase: 'Увеличить таймер',
    adjustHint: 'Клик: ±1 мин · Shift+клик: ±30 сек',
    expired: 'Время вышло',
    oneMinuteWarning: 'Осталась 1 минута',
  },
  voting: {
    addVote: 'Голос',
    removeVote: 'Убрать голос',
    votesUsed: 'голосов использовано',
    votesRemaining: 'осталось',
    voteBudget: 'Ваши голоса',
  },
  discuss: {
    topCards: 'Карточки с наибольшим числом голосов',
    addActionItem: 'Добавить пункт плана',
    actionItemsTitle: 'План действий',
    actionItemPlaceholder: 'Что мы с этим будем делать?',
    actionItemOwnerLabel: 'Ответственный',
    deleteActionItem: 'Удалить',
    tooManyActionsWarning:
      'Исследования показывают: команды чаще выполняют пункты, если их не больше 3 за ретро.',
    // Редизайн фазы обсуждения (Stage 6) — кикеры, заголовки, подсказки.
    phaseKicker: 'ФАЗА ОБСУЖДЕНИЯ',
    topCardsHeading: 'Наиболее проголосованные',
    topCardsEmpty: 'голосов пока нет — обсуждать нечего',
    actionItemsKicker: 'ПЛАН ДЕЙСТВИЙ',
    actionItemsTipKicker: 'совет: сохраняйте фокус',
    groupedCardsKicker: 'ГРУППА',
    cardsKicker: 'КАРТОЧКИ',
    votesTag: (count: number) => pluralizeRu(count, 'голос', 'голоса', 'голосов'),
    authorKicker: 'от',
  },
  close: {
    title: 'Ретро завершено',
    summarySubtitle: 'Вы можете экспортировать результаты ниже.',
    exportCopy: 'Скопировать markdown в буфер обмена',
    exportDownload: 'Скачать как .md',
    backToLobby: 'Вернуться к списку',
    viewResults: 'Результаты',
    exportKicker: 'ЭКСПОРТ',
  },
  share: {
    dialogTitle: 'Поделиться этим ретро',
    description: 'Отправьте ссылку команде. Они присоединятся, открыв её.',
    copyLink: 'Скопировать ссылку',
    qrLabel: 'Или отсканируйте QR-код',
    done: 'Готово',
    kicker: 'ПОДЕЛИТЬСЯ',
    copied: 'Скопировано!',
  },
  confirm: {
    kicker: 'ПОДТВЕРЖДЕНИЕ',
  },
  markdown: {
    cardsCount: (count: number) =>
      `${count} ${pluralizeRu(count, 'карточка', 'карточки', 'карточек')}`,
    votesCount: (count: number) => `${count} ${pluralizeRu(count, 'голос', 'голоса', 'голосов')}`,
    actionItemsTitle: 'План действий',
    noCards: 'Нет карточек.',
    noActionItems: 'Нет пунктов плана.',
    fromLabel: 'из',
  },
  errors: {
    loadRoomsFailed: 'Не удалось загрузить ваши ретро.',
    connectFailed: 'Не удалось подключиться к этому ретро.',
    copyFailed: 'Не удалось скопировать в буфер обмена.',
    actionForbidden: 'Это может сделать только владелец.',
    signalingUnavailableTitle: 'Сигнальный сервер WebRTC недоступен',
    signalingUnavailableBody:
      'Для работы ретро нужен сигнальный сервер, который помогает участникам установить P2P-соединение. Все настроенные серверы сейчас недоступны — обычно это временно. Обнови страницу через минуту или попробуй позже.',
    signalingKicker: 'ОШИБКА / СИГНАЛИНГ',
  },
};
