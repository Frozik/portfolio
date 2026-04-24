import { Temporal } from '@js-temporal/polyfill';

import type { welcomeTranslationsEn } from './en';

const RUSSIAN_PLURAL_MOD_100_BOUNDARY = 100;
const RUSSIAN_PLURAL_MOD_10_BOUNDARY = 10;
const RUSSIAN_PLURAL_TEEN_START = 11;
const RUSSIAN_PLURAL_TEEN_END = 19;
const RUSSIAN_PLURAL_FEW_END = 4;

function pluralizeRussianYears(value: number): string {
  const mod100 = value % RUSSIAN_PLURAL_MOD_100_BOUNDARY;
  const mod10 = value % RUSSIAN_PLURAL_MOD_10_BOUNDARY;
  if (mod100 >= RUSSIAN_PLURAL_TEEN_START && mod100 <= RUSSIAN_PLURAL_TEEN_END) {
    return 'лет';
  }
  if (mod10 === 1) {
    return 'год';
  }
  if (mod10 >= 2 && mod10 <= RUSSIAN_PLURAL_FEW_END) {
    return 'года';
  }
  return 'лет';
}

export const welcomeTranslationsRu: typeof welcomeTranslationsEn = {
  nav: {
    brandRoot: 'frozik.github.io',
    brandPath: '/portfolio',
    sections: [
      { id: 'about', label: 'обо мне', number: '01' },
      { id: 'skills', label: 'навыки', number: '02' },
      { id: 'work', label: 'опыт', number: '03' },
      { id: 'projects', label: 'проекты', number: '04' },
      { id: 'contact', label: 'контакты', number: '05' },
    ],
    openOnPhone: 'Открыть на телефоне',
    sourceOnGitHub: 'Исходники на GitHub',
    showQR: 'Показать QR-код этой страницы',
    openMenu: 'Открыть меню',
    menuTitle: 'Навигация',
    sectionsTitle: 'Разделы',
    sectionsHeading: 'разделы',
    projectsHeading: 'проекты',
    closeQR: 'Закрыть QR-код',
    fullscreenLandscape: 'Полноэкранный режим (landscape)',
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
      `${years} ${pluralizeRussianYears(years)} создаю высокопроизводительные веб-приложения — визуализация данных на WebGPU/WebGL, торговые системы реального времени и масштабируемая фронтенд-архитектура в Яндекс.Деньгах и Deutsche Bank.`,
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
        В Яндекс.Деньгах руководил командой из семи инженеров, отвечал за архитектуру продукта,
        внедрил культуру код-ревью и принимал ключевые архитектурные решения в микрофронтенд-
        экосистеме. В Deutsche Bank выпускал продукты корпоративного уровня в Agile / Scrum
        окружении с глубокой кросс-функциональной командной работой.
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
    entries: [
      {
        id: 'hft',
        start: new Temporal.PlainDate(2022, 2, 1),
        company: 'ИП Шаров Дмитрий Николаевич',
        location: 'Россия, Санкт-Петербург',
        role: 'Senior Frontend Engineer · Высокочастотный трейдинг',
        description: (
          <>
            <h4>Для компании высокочастотного трейдинга:</h4>
            <p>
              Разработка набора из 15+ веб-приложений для платформы высокочастотной торговли — от
              визуализации данных в реальном времени до конфигурации систем и управления рисками.
            </p>

            <h4>Визуализация данных:</h4>
            <ul>
              <li>
                Высокопроизводительный движок графиков на WebGL, отображающий десятки миллионов
                точек данных при 60fps с GPU-ускоренным панорамированием и масштабированием от лет
                до наносекунд
              </li>
              <li>
                Интерактивные дашборды с крупномасштабными таблицами (миллионы строк) и потоковой
                передачей данных в реальном времени через WebSocket
              </li>
              <li>
                Среда бэктестинга для анализа производительности торговых роботов на исторических
                данных
              </li>
            </ul>

            <h4>Настройка торговых операций:</h4>
            <ul>
              <li>
                Управление торговыми серверами — конфигурация аккаунтов, инструментов, роботов и
                лимитов риска на нескольких биржах
              </li>
              <li>
                Мониторинг баланса и позиций на всех биржах с конфигурацией рисков и правилами
                ребалансировки
              </li>
              <li>
                Приложение Middle Office для управления рисками, отслеживания PnL и корректировки
                сделок
              </li>
              <li>Анализ торговой статистики и генерация подробных отчётов</li>
            </ul>

            <h4>Инфраструктура Frontend платформы:</h4>
            <ul>
              <li>
                Static Frontend, слой BFF (Backend For Frontend) и разнообразные сервисы на Node.js,
                общающиеся по собственному протоколу поверх WebSocket и через gRPC (HTTP/2)
              </li>
            </ul>
          </>
        ),
      },
      {
        id: 'db',
        start: new Temporal.PlainDate(2019, 1, 1),
        end: new Temporal.PlainDate(2022, 2, 1),
        company: 'Deutsche Bank',
        website: 'https://www.db.com/',
        location: 'Россия, Санкт-Петербург',
        scopeOfActivity: 'Финансовый сектор / Банкинг',
        role: 'Assistant Vice President (Senior Frontend Engineer)',
        description: (
          <>
            <p>Разработка веб-приложения DB Autobahn</p>

            <h4>Обязанности:</h4>
            <ul>
              <li>
                Разработка и поддержка бизнес-критичного веб-приложения с фокусом на
                высокомаржинальную торговлю
              </li>
              <li>Обеспечение бесперебойной работы и максимального качества для пользователей</li>
            </ul>

            <h4>Достижения:</h4>
            <ul>
              <li>
                Разработал 5+ приложений ввода ордеров для разных типов сделок на{' '}
                <a
                  href="https://autobahn.db.com/autobahn/index.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  платформе Autobahn
                </a>
                ; поддерживал флагманские продукты торговли и мониторинга активных ордеров
              </li>
              <li>Модернизировал несколько legacy-приложений</li>
              <li>
                Разработал общую библиотеку UI-контролов, используемую во всех приложениях Autobahn
                — торговый календарь с правилами рабочих дней, поддержка скользящих теноров (TOM,
                TOD, SPOT), ввод дат на естественном языке («tom 10am»), поля ввода финансовых
                данных, компоненты разметки и множество других контролов. Библиотека построена по
                принципам BEM, что обеспечивает поддерживаемый, масштабируемый и переиспользуемый
                код.
              </li>
              <li>
                Спроектировал и предложил фреймворк тестирования на основе описаний страниц с
                воспроизведением ответов сервера, обеспечивающий 100% покрытие
                бизнес-функциональности
              </li>
              <li>
                Внедрил паттерны взаимодействия и оптимизации производительности, добившись запуска
                приложений менее чем за секунду — мгновенная загрузка независимо от сетевых условий,
                даже на самых слабых VDI
              </li>
              <li>Расследовал и устранял инциденты в продакшене</li>
            </ul>
          </>
        ),
      },
      {
        id: 'grid-rj',
        start: new Temporal.PlainDate(2017, 4, 1),
        end: new Temporal.PlainDate(2018, 12, 1),
        company: 'Grid Dynamics (Raymond-James)',
        website: 'https://griddynamics.com/',
        location: 'Россия, Санкт-Петербург',
        role: 'Lead Frontend Developer',
        description: (
          <>
            <p>Разработка внутренней CRM-системы для клиента Raymond-James</p>

            <h4>Обязанности:</h4>
            <ul>
              <li>Разработка и поддержка веб-CRM для оптимизации внутренних процессов</li>
              <li>
                Совместная работа с кросс-функциональными командами для обеспечения плавной
                интеграции и эффективной работы приложения
              </li>
            </ul>

            <h4>Достижения:</h4>
            <ul>
              <li>
                Разработал основные модули CRM: визуальный редактор workflow для настраиваемых
                пайплайнов задач, система управления email-шаблонами, управление контактами и
                сделками, лента активности, ролевая модель доступа
              </li>
              <li>
                Интегрировал CRM с существующей инфраструктурой клиента — сервисы доставки email,
                внутренние директории и системы уведомлений — обеспечив плавную миграцию со старых
                инструментов
              </li>
            </ul>
          </>
        ),
      },
      {
        id: 'grid',
        start: new Temporal.PlainDate(2016, 11, 1),
        end: new Temporal.PlainDate(2017, 4, 1),
        company: 'Grid Dynamics',
        website: 'https://griddynamics.com/',
        location: 'Россия, Санкт-Петербург',
        role: 'Lead Frontend Developer',
        description: (
          <>
            <p>Разработка pre-sale веб-приложения электронной коммерции на Angular 2</p>

            <h4>Описание проекта:</h4>
            <p>
              Proof-of-concept e-commerce платформа на Angular 2 для клиента GridDynamics. Три
              компонента: клиентская часть онлайн-магазина, аналитическая платформа для мониторинга
              инвентаря и продаж, административная панель.
            </p>

            <h4>Достижения:</h4>
            <ul>
              <li>Разработал приложение электронной коммерции с нуля</li>
              <li>
                Представил proof-of-concept, демонстрирующий жизнеспособность e-commerce платформы
                на Angular 2
              </li>
            </ul>
          </>
        ),
      },
      {
        id: 'yamoney',
        start: new Temporal.PlainDate(2012, 8, 1),
        end: new Temporal.PlainDate(2016, 11, 1),
        company: 'Яндекс.Деньги',
        website: 'https://yoomoney.ru/',
        location: 'Россия, Санкт-Петербург',
        scopeOfActivity: 'IT / Интернет / Банкинг — цифровая платёжная платформа',
        role: 'Ведущий разработчик => Тимлид',
        description: (
          <>
            <p>Руководитель разработки портала Контакт-центра</p>

            <h4>Описание проекта:</h4>
            <p>
              Комплексный портал Контакт-центра — центральный хаб для управления всеми клиентскими
              взаимодействиями (звонки, письма, запросы с основного сайта). Уникальные дашборды для
              менеджеров и операторов: дашборд менеджера — мониторинг операторов, качество сервиса,
              планирование роста и стратегическая маршрутизация; дашборд оператора — эффективная
              обработка звонков/писем с историей запросов, шаблонными ответами и внутренней
              пересылкой.
            </p>

            <h4>Обязанности:</h4>
            <ul>
              <li>Руководство и управление командой</li>
              <li>Full-stack разработка</li>
              <li>Архитектура и проектирование ПО</li>
            </ul>

            <h4>Достижения:</h4>
            <ul>
              <li>
                Разработал с нуля инновационный портал Контакт-центра, объединивший клиентские
                запросы в одном месте
              </li>
              <li>
                Контакт-центр был признан «Достижением 2016 года», значительно улучшив время ответа
                и общее качество обслуживания
              </li>
            </ul>
          </>
        ),
      },
      {
        id: 'yandex',
        start: new Temporal.PlainDate(2010, 11, 1),
        end: new Temporal.PlainDate(2012, 8, 1),
        company: 'Яндекс',
        website: 'https://ya.ru/',
        location: 'Россия, Санкт-Петербург',
        scopeOfActivity: 'IT / Интернет',
        role: 'Разработчик',
        description: (
          <>
            <p>Аналитик и разработчик геопространственных данных в Яндекс.Картах</p>

            <h4>Описание проекта:</h4>
            <p>
              Анализ, обработка и рендеринг геопространственных данных для Яндекс.Карт. Разработка
              приложений для картографов — добавление и редактирование объектов (дома, дороги) по
              спутниковым снимкам, аэрофотосъёмке и панорамам, а также проверка ошибок в данных
              поставщиков и собственных данных.
            </p>

            <h4>Достижения:</h4>
            <ul>
              <li>
                Разработал картографические инструменты для анализа, обработки и создания геоданных
                для{' '}
                <a href="https://yandex.ru/maps" target="_blank" rel="noreferrer">
                  Яндекс.Карт
                </a>{' '}
                с использованием спутниковых снимков и панорам
              </li>
            </ul>
          </>
        ),
      },
      {
        id: 'teklabs',
        start: new Temporal.PlainDate(2009, 12, 1),
        end: new Temporal.PlainDate(2010, 11, 1),
        company: 'Teklabs',
        website: 'https://teklabs.com/',
        location: 'Россия, Санкт-Петербург',
        scopeOfActivity: 'IT / Системная интеграция / Интернет',
        role: 'Ведущий разработчик',
        description: (
          <>
            <p>Разработчик веб-приложения для управления сельскохозяйственными данными</p>

            <h4>Описание проекта:</h4>
            <p>
              Silverlight веб-приложение, автоматизирующее ежедневные задачи фермеров и обработку
              данных с ферм по всей стране. Включало мониторинг кормления животных, ветеринарный
              уход, контроль производства и отслеживание объёмов продукции.
            </p>

            <h4>Достижения:</h4>
            <ul>
              <li>
                Разработал предметно-ориентированные модули: мониторинг здоровья животных,
                отслеживание ветеринарных визитов, контроль качества молока, отслеживание объёмов
                производства
              </li>
              <li>
                Построил общую библиотеку UI-контролов (десятки компонентов), принятую на платформе
                — кнопки, поля ввода, формы, сворачиваемые аккордеон-карточки и другое
              </li>
            </ul>
          </>
        ),
      },
      {
        id: 'sitronics',
        start: new Temporal.PlainDate(2008, 1, 1),
        end: new Temporal.PlainDate(2009, 12, 1),
        company: 'Sitronics Telecom Solutions CZ',
        website: 'https://sitronicsts.com/',
        location: 'Чехия, Прага',
        role: 'Ведущий разработчик',
        description: (
          <>
            <p>Разработчик телекоммуникационного ПО для сотовых операторов</p>

            <h4>Описание проекта:</h4>
            <p>
              Информационные системы и технологии для сотовых операторов — обработка платежей,
              управление трафиком, создание тарифных планов, работа с коммуникационным
              оборудованием, доставка трафика между пользователями. Клиенты — МТС, Vodafone Czech
              Republic и другие крупнейшие операторы.
            </p>

            <h4>Достижения:</h4>
            <ul>
              <li>
                Разработал инновационные сервисы для сотовых операторов — мониторинг, биллинг и
                тарификация клиентского трафика для звонков, GPRS, SMS/MMS и USSD
              </li>
            </ul>
          </>
        ),
      },
      {
        id: 'tumlare',
        start: new Temporal.PlainDate(2006, 11, 1),
        end: new Temporal.PlainDate(2007, 12, 1),
        company: 'Tumlare Corporation',
        website: 'https://kuonitumlare.com/',
        location: 'Россия, Санкт-Петербург',
        scopeOfActivity: 'Туристическая компания',
        role: 'Разработчик',
        description: (
          <>
            <p>Разработчик веб-CMS для управления корпоративными сайтами</p>

            <h4>Описание проекта:</h4>
            <p>
              Внутренняя Web CMS для управления контентом корпоративных сайтов и API для интеграции
              других туристических компаний с платформой.
            </p>

            <h4>Достижения:</h4>
            <ul>
              <li>
                Внедрил новые функции, улучшающие пользовательский опыт и оптимизирующие процесс
                управления контентом в CMS
              </li>
            </ul>
          </>
        ),
      },
      {
        id: '1c-rarus',
        start: new Temporal.PlainDate(2005, 4, 1),
        end: new Temporal.PlainDate(2006, 11, 1),
        company: '1С-Рарус',
        website: 'https://rarus.ru/',
        location: 'Россия, Москва',
        scopeOfActivity: 'IT / Системная интеграция / Разработка ПО',
        role: 'Разработчик',
        description: (
          <>
            <p>Разработчик веб-интерфейсов для приложений 1С:Предприятие</p>

            <h4>Описание проекта:</h4>
            <p>
              Веб-интерфейсы для существующих приложений 1С:Предприятие — популярной российской
              платформы автоматизации финансовой и операционной деятельности. Интерфейсы
              обеспечивали удалённое редактирование и обработку данных через интернет / интранет.
            </p>

            <h4>Достижения:</h4>
            <ul>
              <li>
                Разработал несколько веб-интерфейсов для приложений 1С:Предприятие, улучшив
                пользовательский опыт и обеспечив удалённый доступ к управлению данными
              </li>
            </ul>
          </>
        ),
      },
      {
        id: 'freelance',
        start: new Temporal.PlainDate(2002, 3, 1),
        end: new Temporal.PlainDate(2005, 4, 1),
        company: 'Фриланс',
        location: 'Россия, Великий Новгород',
        role: 'Фрилансер',
        description: (
          <>
            <h4>Фриланс-разработчик ПО и веб-дизайнер</h4>
            <p>
              Оказывал услуги разработки и веб-дизайна для компаний Antares Software, Promogroup,
              Hansa Consulting и частных клиентов.
            </p>

            <h4>Достижения:</h4>
            <ul>
              <li>
                Для Antares Software:
                <ul>
                  <li>
                    Разработал игру Cetris для <strong>карманного сканера C Pen 600C</strong>
                  </li>
                  <li>Игры для устройств Windows CE</li>
                  <li>Файловая система для Windows-игр</li>
                </ul>
              </li>
              <li>
                Для Promogroup:
                <ul>
                  <li>
                    Сайт <strong>Gazinvest Bank</strong>
                  </li>
                  <li>
                    Сайт <strong>ID Cards</strong>
                  </li>
                </ul>
              </li>
              <li>
                Для Hansa Consulting:
                <ul>
                  <li>
                    Реализовал контент-фильтрующий HTTP-прокси для усиления сетевой безопасности
                  </li>
                </ul>
              </li>
              <li>
                Для частных клиентов — разрабатывал различные сайты и standalone-приложения под их
                задачи
              </li>
            </ul>
          </>
        ),
      },
    ],
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
      retro: {
        meta: 'Коллаборация · P2P',
        title: 'Retro',
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
    headline2: 'Поговорим.',
    lead: (
      <>
        Рассматриваю роли <strong className="font-medium text-landing-fg">Senior Frontend</strong>{' '}
        или <strong className="font-medium text-landing-fg">Team Lead</strong> —{' '}
        <strong className="font-medium text-landing-fg">удалённо</strong> или{' '}
        <strong className="font-medium text-landing-fg">в офисе</strong>.
        <strong className="font-medium text-landing-fg">в офисе</strong>.
      </>
    ),
    footerCopyright: (year: number) =>
      `© ${year} — Дмитрий Шаров · Сделано на React + WebGPU + WebRTC`,
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
    entries: {
      telegram: { label: '@Frozik', qrTitle: 'TELEGRAM · @FROZIK' },
      whatsapp: { label: 'Дмитрий Шаров', qrTitle: 'WHATSAPP · ДМИТРИЙ ШАРОВ' },
      email: { label: 'frozik@gmail.com', qrTitle: 'EMAIL · FROZIK@GMAIL.COM' },
      github: { label: '/frozik', qrTitle: 'GITHUB · /FROZIK' },
      linkedin: { label: '/frozik', qrTitle: 'LINKEDIN · /FROZIK' },
    },
  },
};
