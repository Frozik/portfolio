import { selectPluralForm } from '../../../../shared/i18n/plural';
import type { welcomeTranslationsEn } from './en';
import { welcomeEarlierExperienceRu } from './ru-experience-earlier';
import { welcomeRecentExperienceRu } from './ru-experience-recent';

const RUSSIAN_YEAR_FORMS = { one: 'год', few: 'года', many: 'лет' } as const;

function pluralizeRussianYears(value: number): string {
  return selectPluralForm('ru', value, RUSSIAN_YEAR_FORMS);
}

export const welcomeTranslationsRu: typeof welcomeTranslationsEn = {
  dateLocale: 'ru-RU',
  duration: {
    lessThanAMonth: 'менее месяца',
    years: (value: number) => `${value} ${selectPluralForm('ru', value, RUSSIAN_YEAR_FORMS)}`,
    months: (value: number) =>
      `${value} ${selectPluralForm('ru', value, { one: 'месяц', few: 'месяца', many: 'месяцев' })}`,
  },
  hero: {
    remote: 'Удалённо · по всему миру',
    utc: 'UTC+3',
    available: 'Открыт для удалённой работы',
    headline1: 'Senior Frontend',
    headline2: 'Engineer',
    headlineAccent: 'Team Lead',
    name: 'Дмитрий Шаров',
    lead: (years: number) =>
      `${years} ${pluralizeRussianYears(years)} создаю высокопроизводительные веб-приложения — визуализация данных на WebGPU/WebGL, торговые системы реального времени и масштабируемая фронтенд-архитектура.`,
    yearsOfExperienceLabel: 'Лет опыта',
    stats: [
      { value: '7', label: 'Инженеров в команде' },
      { value: '30', unit: '+', label: 'Приложений' },
      { value: '∞', label: 'Строк TypeScript' },
    ],
    seeWork: 'Посмотреть работы',
    projectCount: '10 проектов',
    scrollHint: 'дальше — больше',
  },
  about: {
    sectionNumber: '01',
    sectionKicker: 'обо мне',
    sectionTitle: 'Кто я',
    paragraph1: (
      <>
        Я <strong className="font-medium text-landing-fg">Senior Frontend Engineer</strong> и{' '}
        <strong className="font-medium text-landing-fg">Team Leader</strong> с большим опытом
        выпуска продакшн-софта в требовательных областях — платформы высокочастотного трейдинга,
        корпоративный банкинг и визуализация данных в реальном времени.
      </>
    ),
    paragraph2: (
      <>
        Руководил командой из семи инженеров, отвечал за архитектуру продуктов целиком — от
        фронтенда и BFF-слоя до полной вертикали front-to-back. Выстраивал культуру код-ревью и
        CI/CD-пайплайны, выпускал продукты корпоративного уровня в Agile / Scrum окружении с
        глубокой кросс-функциональной командной работой между инженерами, дизайнерами и
        продакт-менеджерами.
      </>
    ),
    paragraph3: (
      <>
        Сейчас специализируюсь на <strong className="font-medium text-landing-fg">WebGPU</strong> и{' '}
        <strong className="font-medium text-landing-fg">WebGL</strong> для интерфейсов с большими
        объёмами данных, системах реального времени на WebSockets, менторинге инженеров и развитии
        их мастерства.
      </>
    ),
  },
  skills: {
    sectionNumber: '02',
    sectionKicker: 'навыки',
    sectionTitle: '*Стек*, которым я пользуюсь',
    groups: [
      {
        group: 'Языки и основа',
        items: ['TypeScript', 'JavaScript', 'HTML / CSS', 'Node.js'],
      },
      {
        group: 'Фреймворки и UI',
        items: ['React', 'Next.js', 'React Router', 'Radix UI', 'Tailwind CSS', 'Storybook'],
      },
      {
        group: 'Состояние и данные',
        items: ['MobX', 'Zustand', 'Redux Toolkit', 'RxJS', 'GraphQL', 'CRDT'],
      },
      {
        group: 'Графика и Realtime',
        items: ['WebGPU', 'WebGL', 'TensorFlow.js', 'Matter.js', 'WebRTC', 'WebSocket'],
      },
      {
        group: 'Сборка и тулинг',
        items: ['Webpack', 'Vite', 'NX', 'Biome', 'Docker', 'GitHub Actions'],
      },
      {
        group: 'Тестирование',
        items: ['Vitest', 'Jest', 'Playwright', 'Cypress'],
      },
      {
        group: 'Бэкенд и инфраструктура',
        items: ['Fastify', 'PostgreSQL', 'Redis', 'REST API', 'OAuth 2.0 / JWT', 'Message Queues'],
      },
      {
        group: 'Руководство',
        items: [
          'Руководство командой',
          'Владение архитектурой',
          'Код-ревью и менторинг',
          'Agile / Scrum',
          'Кросс-функциональность',
          'Реагирование на инциденты',
        ],
      },
    ],
  },
  experience: {
    sectionNumber: '03',
    sectionKicker: 'опыт',
    sectionTitle: 'История *работы*',
    tillNow: 'сейчас',
    entries: [...welcomeRecentExperienceRu, ...welcomeEarlierExperienceRu],
  },
  projects: {
    sectionNumber: '04',
    sectionKicker: 'проекты',
    sectionTitle: 'Избранные *проекты*',
    entries: {
      pendulum: {
        meta: 'AI · ГА + Нейросеть',
        title: 'Маятник',
        description:
          'Генетический алгоритм выводит маленькие нейросети, пока одна из них не научится держать перевёрнутый маятник. Смотрите, как умнеют поколения, — или возьмите маятник и попробуйте сами.',
        status: 'обучение',
      },
      sun: {
        meta: 'WebGPU · Проверка рендеринга',
        title: 'Солнце',
        description:
          'Четверть миллиона частиц, закрученных в солнце, — так я проверял WebGPU на прочность.',
        status: '250K частиц',
      },
      graphics: {
        meta: 'WebGPU · Примитивы',
        title: 'Графика',
        description:
          'Небольшой холст на WebGPU: линии любой толщины, градиенты и простые фигуры — всё рисует шейдер.',
        status: '10k примитивов',
      },
      timeseries: {
        meta: 'WebGPU · Графики',
        title: 'Таймсерии',
        description:
          'Движок графиков на WebGPU: свечи, линии и не только — плавно даже на больших данных. Четыре графика делят один GPU-контекст, а данные живут прямо в видеопамяти.',
        status: 'live',
      },
      binance: {
        meta: 'WebGPU · Живой рынок',
        title: 'Binance Orderbook',
        description:
          'Живая тепловая карта стакана Binance: видно, где стоят деньги рынка и как они движутся — тик за тиком.',
        status: 'btcusdt',
      },
      sudoku: {
        meta: 'Игры · Головоломка',
        title: 'Судоку',
        description:
          'Судоку, в которое приятно играть самому: удобное управление, автоматические пометки, мгновенная проверка и отмена ходов.',
        status: 'играть',
      },
      stereometry: {
        meta: 'Игры · 3D-геометрия',
        title: 'Стереометрия',
        description:
          'Тренажёр по стереометрии: стройте прямые и плоскости на многогранниках и решайте школьную классику — например, сечение пирамиды.',
        status: '3d',
      },
      tanks: {
        meta: 'Игры · WebGPU-аркада',
        title: 'Танчики',
        description:
          'Battle City, собранный с нуля: все 35 уровней, ощущения и тайминги оригинала, а пиксель-арт и звук рождаются прямо в коде. Клавиатура или тач.',
        status: 'играть',
      },
      scorched: {
        meta: 'Игры · WebGPU-артиллерия',
        title: 'Scorched',
        description:
          'Scorched Earth в браузере: до десяти танков за одним экраном, разрушаемый ландшафт, ветер, щиты и 33 вида оружия — против друзей или восьми характеров ИИ.',
        status: '33 оружия',
      },
      'space-golf': {
        meta: 'Игры · Физика на WebGPU',
        title: 'Космический гольф',
        description:
          'Гольф, в котором гравитация идёт за мячом: стена, которой он коснулся, становится полом. Поле не кончается — впереди всегда ещё одна лунка.',
        status: 'бесконечные уровни',
      },
      'site-planner': {
        meta: 'CAD · 2D-план + 3D-рельеф',
        title: 'Планировщик участка',
        description:
          'Спланируйте участок в 2D — дом, деревья, дорожки, рельеф — и посмотрите на него в 3D, с тенями от настоящего солнца в любой день и час.',
        status: '2d → 3d',
      },
      retro: {
        meta: 'Коллаборация · P2P',
        title: 'Ретроспектива',
        description:
          'Доска для командной ретроспективы: карточки, голосование, таймер. Участники соединяются напрямую, peer-to-peer — без сервера посередине.',
        status: 'p2p',
      },
      conf: {
        meta: 'Коллаборация · AR',
        title: 'AR Видеочат',
        description:
          'Видеочат один на один, который надевает на вас AR-очки и держит их на лице, как бы вы ни двигались. Всё работает прямо в браузере.',
        status: 'live',
      },
      controls: {
        meta: 'UI/UX · Библиотека контролов',
        title: 'Controls',
        description:
          'Поля ввода, которых мне не хватало в других приложениях: числовое с подсветкой пипсов и выбор даты, понимающий «tom 13:00» или «next fri 9am».',
        status: 'ввод',
      },
    },
  },
  contact: {
    sectionNumber: '05',
    sectionKicker: 'контакты',
    headline1: 'Сложная задача на фронтенде?',
    headline2: 'Обсудим.',
    lead: (
      <>
        Рассматриваю роли <strong className="font-medium text-landing-fg">Senior Frontend</strong>{' '}
        или <strong className="font-medium text-landing-fg">Team Lead</strong> —{' '}
        <strong className="font-medium text-landing-fg">удалённо</strong> или{' '}
        <strong className="font-medium text-landing-fg">в офисе</strong>.
      </>
    ),
    footerCopyright: (year: number) =>
      `© ${year} — Дмитрий Шаров · Сделано на React + WebGPU + WebSocket + WebRTC`,
  },
  statusLabels: {
    online: 'В сети',
    away: 'Не в сети',
    weekend: 'Выходной',
  },
  contacts: {
    preferredLabel: 'предпочтительно',
    openQR: 'Открыть QR',
    showQRFor: (label: string) => `Показать QR для ${label}`,
    copyLink: 'скопировать ссылку',
    copied: 'скопировано в буфер',
    qrLinkLabel: 'ССЫЛКА',
    downloadCv: 'Скачать резюме (PDF)',
    downloadingCv: 'Готовлю PDF…',
    entries: {
      telegram: { label: '@Frozik', qrTitle: 'TELEGRAM · @FROZIK' },
      whatsapp: { label: 'Дмитрий Шаров', qrTitle: 'WHATSAPP · ДМИТРИЙ ШАРОВ' },
      email: { label: 'frozik@gmail.com', qrTitle: 'EMAIL · FROZIK@GMAIL.COM' },
      github: { label: '/frozik', qrTitle: 'GITHUB · /FROZIK' },
      linkedin: { label: '/frozik', qrTitle: 'LINKEDIN · /FROZIK' },
    },
  },
};
