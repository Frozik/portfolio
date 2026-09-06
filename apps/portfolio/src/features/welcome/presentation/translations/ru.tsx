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
          'Демо-приложение: генетический алгоритм ищет нейросеть, способную сбалансировать обратный маятник. Наблюдайте эволюцию поколений, сравнивайте лучшие результаты, изучайте структуру сети в реальном времени — или возьмите маятник и попробуйте удержать его в равновесии сами.',
        status: 'обучение',
      },
      sun: {
        meta: 'WebGPU · Проверка рендеринга',
        title: 'Солнце',
        description:
          'Приложение для проверки рендеринга на WebGPU — миллион частиц, отрисованных шейдерами на GPU, проверка конвейера и пропускной способности.',
        status: '1M частиц',
      },
      graphics: {
        meta: 'WebGPU · Примитивы',
        title: 'Графика',
        description:
          'Холст для отрисовки 2D-примитивов на WebGPU — линии разной толщины с градиентной заливкой и простые 2D-фигуры, отрисованные на fragment-шейдере.',
        status: '10k примитивов',
      },
      timeseries: {
        meta: 'WebGPU · Графики',
        title: 'Таймсерии',
        description:
          'Полнофункциональный движок графиков на WebGPU — свечи, линии, ромбы и другое, с попиксельным цветом, прозрачностью и толщиной, зависящими от значения. 4 графика используют один общий WebGPU-контекст — пример shared renderer. Все данные хранятся на GPU в текстуре.',
        status: 'live',
      },
      binance: {
        meta: 'WebGPU · Живой рынок',
        title: 'Binance Orderbook',
        description:
          'Живая тепловая карта глубины рынка на реальных данных Binance. Ценовые уровни во времени рендерятся на GPU, так что каждый тик появляется на экране в момент прихода из сокета.',
        status: 'btcusdt',
      },
      sudoku: {
        meta: 'Игры · Головоломка',
        title: 'Судоку',
        description:
          'Судоку с удобным управлением, валидацией результата, автоматическими карандашными пометками и возможностью отмены ходов.',
        status: 'играть',
      },
      stereometry: {
        meta: 'Игры · 3D-геометрия',
        title: 'Стереометрия',
        description:
          '3D-тренажёр стереометрии — постройте прямые и плоскости на многогранниках и решайте классические задачи, например поиск сечения пирамиды плоскостью, заданной двумя прямыми.',
        status: '3d',
      },
      tanks: {
        meta: 'Игры · WebGPU-аркада',
        title: 'Танчики',
        description:
          'Ремейк Battle City с рендером на WebGPU — все 35 оригинальных уровней, физика, ИИ врагов и тайминги перенесены из оригинальной игры, пиксель-арт и звук синтезируются кодом. Клавиатура или тач.',
        status: 'играть',
      },
      scorched: {
        meta: 'Игры · WebGPU-артиллерия',
        title: 'Scorched',
        description:
          'Ремейк Scorched Earth на WebGPU — артиллерийская дуэль на одном устройстве до десяти танков по разрушаемому ландшафту: каталог оружия из оригинального мануала, ветер, щиты и восемь характеров ИИ. Воронки, осыпающаяся земля и частицы взрывов считаются на compute-шейдерах.',
        status: '33 оружия',
      },
      'site-planner': {
        meta: 'CAD · 2D-план + 3D-рельеф',
        title: 'Планировщик участка',
        description:
          'Планировщик земельного участка. Контур участка и пятно застройки собираются из прямоугольников и кругов, рельеф задаётся отметками высот, добавляются деревья и дорожки — а затем всё это смотрится в 3D на WebGPU: тени от реального солнца на выбранные дату и время, анализ уклонов и объёмов срезки-подсыпки. Скан плана можно подложить и обвести, лист выгрузить в PNG, а план — в JSON.',
        status: '2d → 3d',
      },
      retro: {
        meta: 'Коллаборация · P2P',
        title: 'Ретроспектива',
        description:
          'Доска ретроспективы в реальном времени. Участники подключаются по WebRTC peer-to-peer — карточки, голосование, таймер и фазы синхронизируются без центрального сервера.',
        status: 'p2p',
      },
      conf: {
        meta: 'Коллаборация · AR',
        title: 'AR Видеочат',
        description:
          'Видеочат 1-на-1 с real-time трекингом лица, накладывающим AR-очки на лицо собеседника. Работает полностью в браузере — без плагинов и серверных вычислений.',
        status: 'live',
      },
      controls: {
        meta: 'UI/UX · Библиотека контролов',
        title: 'Controls',
        description:
          'Коллекция отполированных контролов ввода — числовой с PIP-подсветкой, свободный пикер даты и времени, парсящий человеческие фразы ("tom 13:00", "next fri 9am", "eom 23:59"), и другие.',
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
