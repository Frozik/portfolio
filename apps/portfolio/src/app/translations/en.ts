export interface INavSectionTranslation {
  readonly id: string;
  readonly label: string;
  readonly number: string;
}

export const appTranslationsEn = {
  appTitle: 'Portfolio',
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
    backToHome: 'Back to home',
  },
  pageTitles: {
    cv: 'CV',
    pendulum: 'Pendulum',
    sudoku: 'Sudoku',
    sun: 'Sun',
    graphics: 'Graphics',
    timeseries: 'Timeseries',
    binance: 'Binance Orderbook',
    stereometry: 'Stereometry',
    controls: 'Controls',
    retro: 'Retro',
    conf: 'Conf',
  },
  errorPage: {
    statusMap: {
      404: { text: 'Not Found', message: 'This page wandered off into the void...' },
      405: { text: 'Method Not Allowed', message: "You can't do that here!" },
      406: { text: 'Not Acceptable', message: 'Nope, not gonna happen.' },
      407: {
        text: 'Proxy Auth Required',
        message: 'Who are you? Identify yourself!',
      },
      408: { text: 'Request Timeout', message: 'Waited too long... fell asleep.' },
      409: { text: 'Conflict', message: "Something's fighting something else." },
      410: { text: 'Gone', message: "It was here. Now it's not. Poof." },
      411: { text: 'Length Required', message: "How long? You didn't say!" },
      412: { text: 'Precondition Failed', message: 'You forgot something important.' },
      413: { text: 'Payload Too Large', message: "That's way too much stuff!" },
      414: { text: 'URI Too Long', message: 'That URL goes on forever...' },
      415: { text: 'Unsupported Media Type', message: "Can't read that format, sorry." },
      416: { text: 'Range Not Satisfiable', message: 'That range is out of bounds.' },
      417: { text: 'Expectation Failed', message: "Didn't live up to expectations..." },
      418: {
        text: "I'm a Teapot",
        message: 'Short and stout. You found the easter egg!',
      },
    } as Record<number, { text: string; message: string }>,
    teapotHint: 'Click the number to start over',
    clickHint: 'Psst... try clicking the number',
    takeMeHome: 'Take me home',
  },
} as const;
