import { Temporal } from '@js-temporal/polyfill';
import type { ReactNode } from 'react';

export interface IExperienceTranslation {
  readonly id: string;
  readonly start: Temporal.PlainDate;
  readonly end?: Temporal.PlainDate;
  readonly company: string;
  readonly website?: string;
  readonly location?: string;
  readonly scopeOfActivity?: ReactNode;
  readonly role: string;
  readonly description: ReactNode;
}

export interface ISkillGroupTranslation {
  readonly group: string;
  readonly items: readonly string[];
}

export interface IHeroStatTranslation {
  readonly value: string;
  readonly unit?: string;
  readonly label: string;
}

export interface INavSectionTranslation {
  readonly id: string;
  readonly label: string;
  readonly number: string;
}

export interface IProjectTranslation {
  readonly meta: string;
  readonly title: string;
  readonly description: string;
  readonly status: string;
}

export interface IContactLabels {
  readonly label: string;
  readonly qrTitle: string;
}

export const welcomeTranslationsEn = {
  nav: {
    brandRoot: 'frozik.github.io',
    brandPath: '/portfolio',
    sections: [
      { id: 'about', label: 'about', number: '01' },
      { id: 'skills', label: 'skills', number: '02' },
      { id: 'work', label: 'work', number: '03' },
      { id: 'projects', label: 'projects', number: '04' },
      { id: 'contact', label: 'contact', number: '05' },
    ] as readonly INavSectionTranslation[],
    openOnPhone: 'Open on phone',
    sourceOnGitHub: 'Source on GitHub',
    showQR: 'Show QR code for this page',
    openMenu: 'Open menu',
    menuTitle: 'Navigation',
    sectionsTitle: 'Sections',
    sectionsHeading: 'sections',
    projectsHeading: 'projects',
    closeQR: 'Close QR code',
    fullscreenLandscape: 'Fullscreen landscape',
  },
  hero: {
    remote: 'Remote · worldwide',
    utc: 'UTC+3',
    available: 'Available for remote work',
    headline1: 'Senior Frontend',
    headline2: 'Engineer',
    headlineAccent: 'Team Lead',
    name: 'Dmitry Sharov',
    lead: (years: number) =>
      `${years} years building high-performance web applications — WebGPU/WebGL data visualization, real-time trading systems, and scalable frontend architecture at Yandex.Money and Deutsche Bank.`,
    yearsOfExperienceLabel: 'Years of experience',
    stats: [
      { value: '7', label: 'Engineers led' },
      { value: '30', unit: '+', label: 'Apps shipped' },
      { value: '∞', label: 'Lines of TypeScript' },
    ] as readonly IHeroStatTranslation[],
    seeWork: 'See selected work',
    projectCount: '10 projects',
    scrollHint: 'scroll to explore',
  },
  about: {
    sectionNumber: '01',
    sectionKicker: 'about',
    sectionTitle: 'Who I am',
    paragraph1: (
      <>
        I'm a <strong className="font-medium text-landing-fg">Senior Frontend Engineer</strong> and{' '}
        <strong className="font-medium text-landing-fg">Team Leader</strong> with a long history of
        shipping production software in demanding domains — high-frequency trading platforms,
        enterprise banking, and real-time data visualization.
      </>
    ),
    paragraph2: (
      <>
        At Yandex.Money I led a team of seven engineers, owning product architecture end-to-end,
        establishing code review culture, and driving key architectural decisions across a
        micro-frontend ecosystem. At Deutsche Bank I delivered enterprise-grade products in Agile /
        Scrum environments with deeply cross-functional teams.
      </>
    ),
    paragraph3: (
      <>
        Today I specialize in <strong className="font-medium text-landing-fg">WebGPU</strong> and{' '}
        <strong className="font-medium text-landing-fg">WebGL</strong> for data-heavy interfaces,
        real-time systems with WebSockets, and mentoring engineers into better craft.
      </>
    ),
  },
  skills: {
    sectionNumber: '02',
    sectionKicker: 'skills',
    sectionTitle: '*Stack* I reach for',
    groups: [
      {
        group: 'Languages & Core',
        items: ['TypeScript', 'JavaScript', 'HTML / CSS', 'Node.js'],
      },
      {
        group: 'Frameworks & UI',
        items: ['React', 'Next.js', 'React Router', 'Radix UI', 'Tailwind CSS', 'Storybook'],
      },
      {
        group: 'State & Data',
        items: ['MobX', 'Zustand', 'Redux Toolkit', 'RxJS', 'GraphQL', 'CRDT'],
      },
      {
        group: 'Graphics & Realtime',
        items: ['WebGPU', 'WebGL', 'TensorFlow.js', 'Matter.js', 'WebRTC', 'WebSocket'],
      },
      {
        group: 'Build & Tooling',
        items: ['Webpack', 'Vite', 'NX', 'Biome', 'Docker', 'GitHub Actions'],
      },
      {
        group: 'Testing',
        items: ['Vitest', 'Jest', 'Playwright', 'Cypress'],
      },
      {
        group: 'Backend & Infra',
        items: ['Fastify', 'PostgreSQL', 'Redis', 'REST API', 'OAuth 2.0 / JWT', 'Message Queues'],
      },
      {
        group: 'Leadership',
        items: [
          'Team Leadership',
          'Architecture Ownership',
          'Code Review & Mentoring',
          'Agile / Scrum',
          'Cross-functional Collab',
          'Incident Response',
        ],
      },
    ] as readonly ISkillGroupTranslation[],
  },
  experience: {
    sectionNumber: '03',
    sectionKicker: 'experience',
    sectionTitle: '*Work* history',
    tillNow: 'now',
    entries: [
      {
        id: 'hft',
        start: new Temporal.PlainDate(2022, 2, 1),
        company: 'IP Sharov Dmitry Nikolaevich',
        location: 'Russia, Saint Petersburg',
        role: 'Senior Frontend Engineer · High-Frequency Trading',
        description: (
          <>
            <h4>For High-Frequency Trading company:</h4>
            <p>
              Building a suite of 15+ web applications for a high-frequency trading platform — from
              real-time data visualization to system configuration and risk management.
            </p>

            <h4>Data Visualization:</h4>
            <ul>
              <li>
                High-performance WebGL charting engine rendering tens of millions of data points at
                60fps with GPU-accelerated pan/zoom, scalable from years down to nanoseconds
              </li>
              <li>
                Interactive dashboards with large-scale tables (millions of rows) and real-time data
                streaming via WebSocket
              </li>
              <li>
                Backtesting environment for analyzing trading robot performance on historical data
              </li>
            </ul>

            <h4>Trading Operations UI:</h4>
            <ul>
              <li>
                Trading server management — configuration of accounts, instruments, robots, and risk
                limits across multiple exchanges
              </li>
              <li>
                Balance and position monitoring across all exchanges with risk configuration and
                rebalancing rules
              </li>
              <li>
                Middle Office application for Risk Management, PnL tracking, and trade corrections
              </li>
              <li>Trading statistics analysis and comprehensive report generation</li>
            </ul>

            <h4>Frontend Platform Infrastructure:</h4>
            <ul>
              <li>
                Static Frontend, a BFF (Backend For Frontend) layer, and a variety of Node.js
                services communicating over a custom WebSocket protocol and gRPC (HTTP/2)
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
        location: 'Russia, Saint Petersburg',
        scopeOfActivity: 'Financial Sector / Banking',
        role: 'Assistant Vice President (Senior Frontend Engineer)',
        description: (
          <>
            <p>Development of DB Autobahn Web Application</p>

            <h4>Responsibilities:</h4>
            <ul>
              <li>
                Develop and maintain a business-critical web application, focusing on high-profit
                trading
              </li>
              <li>Ensure seamless operation and top-quality functionality for users</li>
            </ul>

            <h4>Achievements:</h4>
            <ul>
              <li>
                Built 5+ order entry apps for different trade types on the{' '}
                <a
                  href="https://autobahn.db.com/autobahn/index.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  Autobahn platform
                </a>
                ; maintained flagship trading and active order monitoring products
              </li>
              <li>Revamped and modernized several legacy applications</li>
              <li>
                Developed a shared UI controls library used across all Autobahn applications —
                trading calendar with business day rules, sliding tenor support (TOM, TOD, SPOT),
                natural language date input (e.g. &quot;tom 10am&quot;), financial data input
                fields, layout components, and a wide range of other controls. The library was built
                following BEM principles, ensuring maintainable, scalable, and reusable code.
              </li>
              <li>
                Designed and proposed a page-description-based testing framework with server
                response replay, enabling 100% business functionality coverage.
              </li>
              <li>
                Implemented interaction patterns and performance optimizations, achieving sub-second
                application startup times — ensuring instant loading regardless of network
                conditions, even on the weakest VDI setups.
              </li>
              <li>Investigated and resolved production incidents</li>
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
        location: 'Russia, Saint Petersburg',
        role: 'Lead Frontend Developer',
        description: (
          <>
            <p>Development of Internal-Use CRM Software for Raymond-James customer</p>

            <h4>Responsibilities:</h4>
            <ul>
              <li>Develop and maintain a web-based CRM system to streamline internal processes</li>
              <li>
                Collaborate with cross-functional teams to ensure seamless integration and efficient
                functionality of the application
              </li>
            </ul>

            <h4>Achievements:</h4>
            <ul>
              <li>
                Built core CRM modules: visual workflow editor for customizable task pipelines,
                email template management system, contact and deal management views, activity
                timeline, and role-based access controls
              </li>
              <li>
                Integrated the CRM with customer&apos;s existing infrastructure — email delivery
                services, internal directories, and notification systems — delivering a seamless
                migration from legacy tools
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
        location: 'Russia, Saint Petersburg',
        role: 'Lead Frontend Developer',
        description: (
          <>
            <p>Angular 2 E-commerce Pre-sale Web Application Developer</p>

            <h4>Project Description:</h4>
            <p>
              Proof-of-concept Angular 2 e-commerce platform for a GridDynamics client. Three
              components: a customer-facing online store, an analytics platform for inventory and
              sales performance, and an administration panel.
            </p>

            <h4>Achievements:</h4>
            <ul>
              <li>Developed the e-commerce application from the ground up</li>
              <li>
                Delivered a proof-of-concept demonstrating the viability of a comprehensive Angular
                2-based platform
              </li>
            </ul>
          </>
        ),
      },
      {
        id: 'yamoney',
        start: new Temporal.PlainDate(2012, 8, 1),
        end: new Temporal.PlainDate(2016, 11, 1),
        company: 'Yandex Money',
        website: 'https://yoomoney.ru/',
        location: 'Russia, Saint Petersburg',
        scopeOfActivity: 'IT / Internet / Banking — digital payment platform',
        role: 'Lead developer => Team leader',
        description: (
          <>
            <p>Contact Center Portal Development Lead</p>

            <h4>Project Description:</h4>
            <p>
              Comprehensive Contact Center Portal — the central hub for managing all customer
              interactions (calls, emails, main-site requests). Featured unique dashboards for
              managers and operators: manager dashboard for monitoring operators, service quality,
              growth planning and strategic routing; operator dashboard for efficient call/email
              processing with customer history, template responses and internal forwarding.
            </p>

            <h4>Responsibilities:</h4>
            <ul>
              <li>Team leadership and management</li>
              <li>Full-stack software development</li>
              <li>Software architecture and design</li>
            </ul>

            <h4>Achievements:</h4>
            <ul>
              <li>
                Developed a ground-breaking Contact Center Portal from scratch that integrated
                customer requests in a single place
              </li>
              <li>
                The Contact Center was recognized as the &quot;Achievement of the Year 2016&quot;,
                significantly improving response times and overall service quality
              </li>
            </ul>
          </>
        ),
      },
      {
        id: 'yandex',
        start: new Temporal.PlainDate(2010, 11, 1),
        end: new Temporal.PlainDate(2012, 8, 1),
        company: 'Yandex',
        website: 'https://ya.ru/',
        location: 'Russia, Saint Petersburg',
        scopeOfActivity: 'IT / Internet',
        role: 'Developer',
        description: (
          <>
            <p>Geospatial Data Analyst and Developer at Yandex.Maps</p>

            <h4>Project Description:</h4>
            <p>
              Analysis, processing, and rendering of geospatial data for Yandex.Maps. Developed
              applications assisting cartographers in adding and editing map features (houses,
              roads) from satellite imagery, aerial photographs, and panoramic pictures, plus error
              detection in supplier or self-generated data.
            </p>

            <h4>Achievements:</h4>
            <ul>
              <li>
                Developed cartographic tools for geospatial data analysis, processing, and rendering
                on{' '}
                <a href="https://yandex.ru/maps" target="_blank" rel="noreferrer">
                  Yandex.Maps
                </a>{' '}
                using satellite imagery and panoramic pictures
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
        location: 'Russia, Saint Petersburg',
        scopeOfActivity: 'IT / System Integration / Internet',
        role: 'Lead developer',
        description: (
          <>
            <p>Agricultural Data Management Web Application Developer</p>

            <h4>Project Description:</h4>
            <p>
              Web Silverlight application automating daily farmer tasks and processing data from
              farms across the country. Included monitoring of animal feeding, health care,
              production control, and output volume tracking.
            </p>

            <h4>Achievements:</h4>
            <ul>
              <li>
                Developed domain-specific modules: animal health monitoring, veterinary visit
                tracking, milk quality control, and production output tracking
              </li>
              <li>
                Built a shared UI control library (dozens of components) adopted across the platform
                — buttons, input fields, forms, collapsible accordion cards and more
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
        location: 'Czech Republic, Prague',
        role: 'Lead developer',
        description: (
          <>
            <p>Telecommunications Software Developer for Cellular Operators</p>

            <h4>Project Description:</h4>
            <p>
              Information systems and technologies for cellular operators — payment processing,
              traffic management, tariff plan creation, communication equipment handling, and
              traffic delivery between users. Clients included MTS, Vodafone Czech Republic and
              other leading operators.
            </p>

            <h4>Achievements:</h4>
            <ul>
              <li>
                Developed innovative services for cellular operators — monitoring, billing and
                charging customer traffic for calls, GPRS, SMS/MMS, and USSD
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
        location: 'Russia, Saint Petersburg',
        scopeOfActivity: 'Travel Company',
        role: 'Developer',
        description: (
          <>
            <p>Web CMS Developer for Corporate Site Management</p>

            <h4>Project Description:</h4>
            <p>
              Internal-use Web Content Management System for controlling and managing content of
              corporate websites, plus APIs for other travel companies to integrate.
            </p>

            <h4>Achievements:</h4>
            <ul>
              <li>
                Implemented new features and functionalities that improved the user experience and
                streamlined the content management process in the CMS
              </li>
            </ul>
          </>
        ),
      },
      {
        id: '1c-rarus',
        start: new Temporal.PlainDate(2005, 4, 1),
        end: new Temporal.PlainDate(2006, 11, 1),
        company: '1C-Rarus',
        website: 'https://rarus.ru/',
        location: 'Russia, Moscow',
        scopeOfActivity: 'IT / System Integration / Software Development',
        role: 'Developer',
        description: (
          <>
            <p>Web Interface Developer for 1C:Enterprise Applications</p>

            <h4>Project Description:</h4>
            <p>
              Web interfaces for existing applications within the 1C:Enterprise system — a popular
              Russian platform for automating financial and operational activities. These interfaces
              enabled remote editing and processing of data via internet / intranet.
            </p>

            <h4>Achievements:</h4>
            <ul>
              <li>
                Developed several web interfaces for 1C:Enterprise applications, enhancing user
                experience and facilitating remote access for data management
              </li>
            </ul>
          </>
        ),
      },
      {
        id: 'freelance',
        start: new Temporal.PlainDate(2002, 3, 1),
        end: new Temporal.PlainDate(2005, 4, 1),
        company: 'Freelance',
        location: 'Russia, Veliky Novgorod',
        role: 'Freelancer',
        description: (
          <>
            <h4>Freelance Software Developer and Web Designer</h4>
            <p>
              Provided freelance development and web design services to companies such as Antares
              Software, Promogroup, Hansa Consulting, and individual clients.
            </p>

            <h4>Achievements:</h4>
            <ul>
              <li>
                For Antares Software:
                <ul>
                  <li>
                    Developed Cetris game for the <strong>C Pen 600C Handheld Scanner</strong>
                  </li>
                  <li>Windows CE device games</li>
                  <li>File system for Windows games</li>
                </ul>
              </li>
              <li>
                For Promogroup:
                <ul>
                  <li>
                    <strong>Gazinvest Bank</strong> web site
                  </li>
                  <li>
                    <strong>ID Cards</strong> web site
                  </li>
                </ul>
              </li>
              <li>
                For Hansa Consulting:
                <ul>
                  <li>Implemented a content filtering HTTP proxy to enhance network security</li>
                </ul>
              </li>
              <li>
                For individual clients — designed and developed various websites and standalone
                applications tailored to their needs
              </li>
            </ul>
          </>
        ),
      },
    ] as readonly IExperienceTranslation[],
  },
  projects: {
    sectionNumber: '04',
    sectionKicker: 'projects',
    sectionTitle: "Things I've *built*",
    entries: {
      pendulum: {
        meta: 'AI · GA + Neural Net',
        title: 'Pendulum',
        description:
          "A demo app where a genetic algorithm searches for a neural network capable of balancing an inverted pendulum. Watch generations evolve, compare their best scores, inspect the network's structure live — or grab the pendulum and try balancing it yourself.",
        status: 'training',
      },
      sun: {
        meta: 'WebGPU · Rendering test',
        title: 'Sun',
        description:
          'A WebGPU rendering test — a million particles shaded on the GPU to validate the pipeline and push throughput.',
        status: '1M vertices',
      },
      graphics: {
        meta: 'WebGPU · Primitives',
        title: 'Graphics',
        description:
          'A WebGPU canvas for 2D primitives — variable-thickness lines with gradient fills and simple 2D shapes drawn in a fragment shader.',
        status: '10k prims',
      },
      timeseries: {
        meta: 'WebGPU · Charts',
        title: 'Timeseries',
        description:
          'A full-featured WebGPU charting engine — candles, lines, diamonds and more, with per-point color, transparency and thickness driven by value. 4 charts share a single WebGPU context — a shared-renderer pattern. All data lives on the GPU inside a texture.',
        status: 'live',
      },
      binance: {
        meta: 'WebGPU · Live market',
        title: 'Binance Orderbook',
        description:
          'Live depth-of-market heatmap of real Binance data. Price levels across time are rendered on the GPU so every tick lands on screen the moment it arrives from the socket.',
        status: 'btcusdt',
      },
      sudoku: {
        meta: 'Games · Puzzle',
        title: 'Sudoku',
        description:
          'A Sudoku with comfortable controls, live result validation, automatic pencil marks, and full undo support.',
        status: 'play',
      },
      stereometry: {
        meta: 'Games · 3D geometry',
        title: 'Stereometry',
        description:
          '3D stereometry trainer — construct lines and planes on polyhedra and solve classical problems, like finding the section of a pyramid by a plane defined through two lines.',
        status: '3d',
      },
      retro: {
        meta: 'Collaboration · P2P',
        title: 'Retro',
        description:
          'Realtime retrospective board. Participants connect over WebRTC peer-to-peer — cards, voting, timer and phases sync without a central server.',
        status: 'p2p',
      },
      conf: {
        meta: 'Collaboration · AR',
        title: 'AR Video Chat',
        description:
          "1-to-1 video chat with real-time face tracking that overlays AR glasses on the participant's face. Runs entirely in the browser — no plugins, no server-side inference.",
        status: 'live',
      },
      controls: {
        meta: 'UI/UX · Input library',
        title: 'Controls',
        description:
          'A collection of polished input controls — numeric with PIP highlighting, a free-form date/time picker that parses human phrases ("tom 13:00", "next fri 9am", "eom 23:59"), and more.',
        status: 'input',
      },
    } as Record<string, IProjectTranslation>,
  },
  contact: {
    sectionNumber: '05',
    sectionKicker: 'contact',
    headline1: 'Got a hard frontend problem?',
    headline2: "Let's talk.",
    lead: (
      <>
        Open to <strong className="font-medium text-landing-fg">Senior Frontend</strong> or{' '}
        <strong className="font-medium text-landing-fg">Team Lead</strong> roles —{' '}
        <strong className="font-medium text-landing-fg">remote</strong> or{' '}
        <strong className="font-medium text-landing-fg">on-site</strong>.
      </>
    ),
    footerCopyright: (year: number) =>
      `© ${year} — Dmitry Sharov · Built with React + WebGPU + WebRTC`,
  },
  statusLabels: {
    online: 'Online',
    away: 'Away',
    weekend: 'Day off',
  },
  contacts: {
    preferredLabel: 'preferred',
    openQR: 'Open QR',
    showQRFor: (label: string) => `Show QR for ${label}`,
    copyLink: 'copy link',
    copied: 'copied to clipboard',
    qrLinkLabel: 'LINK',
    entries: {
      telegram: { label: '@Frozik', qrTitle: 'TELEGRAM · @FROZIK' },
      whatsapp: { label: 'Dmitry Sharov', qrTitle: 'WHATSAPP · DMITRY SHAROV' },
      email: { label: 'frozik@gmail.com', qrTitle: 'EMAIL · FROZIK@GMAIL.COM' },
      github: { label: '/frozik', qrTitle: 'GITHUB · /FROZIK' },
      linkedin: { label: '/frozik', qrTitle: 'LINKEDIN · /FROZIK' },
    } as Record<string, IContactLabels>,
  },
};
