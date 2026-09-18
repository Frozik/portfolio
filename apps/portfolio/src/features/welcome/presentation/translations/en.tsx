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
          'A genetic algorithm breeds tiny neural networks until one learns to balance an inverted pendulum. Watch the generations get better — or grab the pendulum and try it yourself.',
        status: 'training',
      },
      sun: {
        meta: 'WebGPU · Rendering test',
        title: 'Sun',
        description:
          'A quarter-million particles swirling into a sun — my stress test for a WebGPU pipeline.',
        status: '250K particles',
      },
      graphics: {
        meta: 'WebGPU · Primitives',
        title: 'Graphics',
        description:
          'A little WebGPU sketchpad: lines of any thickness, gradients and simple shapes, all drawn by a shader.',
        status: '10k prims',
      },
      timeseries: {
        meta: 'WebGPU · Charts',
        title: 'Timeseries',
        description:
          'A charting engine on WebGPU — candles, lines and more, smooth even with a lot of data. Four charts share one GPU context, and the data lives on the GPU.',
        status: 'live',
      },
      binance: {
        meta: 'WebGPU · Live market',
        title: 'Binance Orderbook',
        description:
          "A live heatmap of the Binance order book: see where the market's money sits and how it moves, tick by tick.",
        status: 'btcusdt',
      },
      sudoku: {
        meta: 'Games · Puzzle',
        title: 'Sudoku',
        description:
          'Sudoku the way I like to play it: comfortable controls, automatic pencil marks, instant checks and undo.',
        status: 'play',
      },
      stereometry: {
        meta: 'Games · 3D geometry',
        title: 'Stereometry',
        description:
          'A 3D geometry trainer: draw lines and planes on polyhedra and solve school classics — like the section of a pyramid.',
        status: '3d',
      },
      tanks: {
        meta: 'Games · WebGPU arcade',
        title: 'Tanks',
        description:
          'Battle City, rebuilt from scratch: all 35 stages, the feel and timings of the original, pixel art and sound generated in code. Keyboard or touch.',
        status: '35 stages',
      },
      scorched: {
        meta: 'Games · WebGPU artillery',
        title: 'Scorched',
        description:
          'Scorched Earth for the browser: up to ten tanks at one screen, destructible terrain, wind, shields and 33 weapons — against friends or eight AI characters.',
        status: '33 weapons',
      },
      'space-golf': {
        meta: 'Games · WebGPU physics',
        title: 'Space Golf',
        description:
          'Golf where gravity follows the ball: whichever wall it touches becomes the floor. The course never ends — there is always another cup.',
        status: 'endless levels',
      },
      'site-planner': {
        meta: 'CAD · 2D plan + 3D terrain',
        title: 'Site Planner',
        description:
          'Plan a plot of land in 2D — house, trees, paths, the lie of the ground — then look at it in 3D, with shadows from the real sun on any day and hour.',
        status: '2d → 3d',
      },
      retro: {
        meta: 'Collaboration · P2P',
        title: 'Retro',
        description:
          'A retrospective board for a team: cards, voting, a timer. Everyone connects peer-to-peer — no server in the middle.',
        status: 'p2p',
      },
      conf: {
        meta: 'Collaboration · AR',
        title: 'AR Video Chat',
        description:
          'One-to-one video chat that puts AR glasses on your face and keeps them there as you move. It all runs in the browser.',
        status: 'live',
      },
      controls: {
        meta: 'UI/UX · Input library',
        title: 'Controls',
        description:
          'Inputs I wish every app had: a number field that highlights pips, and a date picker that understands "tom 13:00" or "next fri 9am".',
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
