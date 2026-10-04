export const bugReporterDemoTranslationsEn = {
  kicker: 'bug reporter / treasury desk',
  headlinePrimary: 'Report a bug',
  headlineAccent: 'without leaking the numbers.',
  subtitle:
    'Balances, IBANs and P&L carry the sensitive-data class: every screenshot and recording hides them. Press the bug in the corner, or Ctrl/⌘ + Shift + B.',
  panels: {
    accounts: 'Accounts',
    positions: 'Positions',
    news: 'Market news',
    symptoms: 'Make something go wrong',
  },
  total: 'Total',
  columns: {
    instrument: 'Instrument',
    side: 'Side',
    quantity: 'Qty',
    averagePrice: 'Avg price',
    lastPrice: 'Last',
    profit: 'P&L',
  },
  sides: { long: 'Long', short: 'Short' },
  minutesAgo: (minutes: number) => (minutes === 0 ? 'just now' : `${minutes} min ago`),
  symptoms: {
    transfer: 'Submit transfer',
    recalculate: 'Recalculate portfolio',
    quotes: 'Refresh quotes',
    shuffle: 'Rearrange panels',
    console: 'Flood the console',
  },
  symptomHints: {
    transfer: 'throws an uncaught TypeError',
    recalculate: 'blocks the main thread for 400 ms',
    quotes: 'requests a host that does not exist',
    shuffle: 'shifts the layout',
    console: 'writes 40 lines with objects',
  },
  activity: 'Activity',
  noActivity: 'Nothing triggered yet.',
  guide: {
    title: 'What the report contains',
    hidden:
      'Hidden in captures: account balances, IBANs, quantities and P&L (class bug-mask); the equity curve as a whole (class bug-block).',
    archive:
      'The zip holds report.md and report.json, console.txt, screenshots with their marks baked in and the recording — each section can be left out before download.',
    delivery:
      'Chromium saves through the native file dialog, Firefox and Safari stream through StreamSaver, anything else buffers a download.',
  },
};
