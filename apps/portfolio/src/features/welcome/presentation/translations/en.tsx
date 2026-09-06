import { selectPluralForm } from '../../../../shared/i18n/plural';
import { welcomeEarlierExperienceEn } from './en-experience-earlier';
import { welcomeRecentExperienceEn } from './en-experience-recent';
import type {
  IContactLabels,
  IHeroStatTranslation,
  IProjectTranslation,
  ISkillGroupTranslation,
} from './types';

export const welcomeTranslationsEn = {
  dateLocale: 'en-US',
  duration: {
    lessThanAMonth: 'less than a month',
    years: (value: number) =>
      `${value} ${selectPluralForm('en', value, { one: 'year', other: 'years' })}`,
    months: (value: number) =>
      `${value} ${selectPluralForm('en', value, { one: 'month', other: 'months' })}`,
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
      `${years} years building high-performance web applications — WebGPU/WebGL data visualization, real-time trading systems, and scalable frontend architecture.`,
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
        I led a team of seven engineers and owned product architecture end-to-end — from the
        frontend and BFF layer down through the full front-to-back stack. I established code review
        culture and CI/CD pipelines, and shipped enterprise-grade products in Agile / Scrum
        environments with deeply cross-functional teamwork across engineers, designers, and product
        managers.
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
    entries: [...welcomeRecentExperienceEn, ...welcomeEarlierExperienceEn],
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
          'A WebGPU rendering test — a quarter-million particles shaded on the GPU to validate the pipeline and push throughput.',
        status: '250K particles',
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
      tanks: {
        meta: 'Games · WebGPU arcade',
        title: 'Tanks',
        description:
          'A Battle City remake rendered on WebGPU — all 35 original stages with physics, enemy AI and timings traced from the original game, pixel art and sound synthesized entirely in code. Keyboard or touch.',
        status: '35 stages',
      },
      scorched: {
        meta: 'Games · WebGPU artillery',
        title: 'Scorched',
        description:
          'A Scorched Earth remake on WebGPU — hot-seat artillery for up to ten tanks over destructible terrain, with the original manual\u2019s weapons catalog, wind, shields and eight AI personalities. Crater carving, falling dirt and explosion particles all run in compute shaders.',
        status: '33 weapons',
      },
      'site-planner': {
        meta: 'CAD · 2D plan + 3D terrain',
        title: 'Site Planner',
        description:
          'A land-plot planner. Compose the plot outline and the building footprint from rectangles and circles, survey the ground with elevation marks, plant trees and lay paths — then look at it in 3D on WebGPU, with shadows cast by the real sun of a chosen date and time, slope and cut/fill analysis. Trace a scanned site plan, export the sheet as PNG or the plan as JSON.',
        status: '2d → 3d',
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
      `© ${year} — Dmitry Sharov · Built with React + WebGPU + WebSocket + WebRTC`,
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
    downloadCv: 'Download CV (PDF)',
    downloadingCv: 'Generating PDF…',
    entries: {
      telegram: { label: '@Frozik', qrTitle: 'TELEGRAM · @FROZIK' },
      whatsapp: { label: 'Dmitry Sharov', qrTitle: 'WHATSAPP · DMITRY SHAROV' },
      email: { label: 'frozik@gmail.com', qrTitle: 'EMAIL · FROZIK@GMAIL.COM' },
      github: { label: '/frozik', qrTitle: 'GITHUB · /FROZIK' },
      linkedin: { label: '/frozik', qrTitle: 'LINKEDIN · /FROZIK' },
    } as Record<string, IContactLabels>,
  },
};
