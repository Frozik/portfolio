/** One colour per scheme: `#rrggbb`, or `rgb(r g b / a)` for a translucent one. */
export interface ISchemePair {
  readonly light: string;
  readonly dark: string;
}

export type TColorRole =
  | 'bg'
  | 'bg-elevated'
  | 'bg-card'
  | 'fg'
  | 'fg-dim'
  | 'fg-faint'
  | 'line'
  | 'line-soft'
  | 'accent'
  | 'accent-soft'
  | 'on-accent'
  | 'danger'
  | 'caution'
  | 'positive'
  | 'focus-ring'
  | 'scrim';

/** The semantic palette every client paints with; the dark side is the portfolio's own. */
export const COLOR_ROLES: Readonly<Record<TColorRole, ISchemePair>> = {
  bg: { light: '#f9fafb', dark: '#07090c' },
  'bg-elevated': { light: '#f3f4f6', dark: '#0d1016' },
  'bg-card': { light: '#ffffff', dark: '#0f1320' },
  fg: { light: '#111827', dark: '#e7ecf3' },
  'fg-dim': { light: '#4b5563', dark: '#a2adbd' },
  'fg-faint': { light: '#636b78', dark: '#76819a' },
  line: { light: 'rgb(0 0 0 / 0.12)', dark: 'rgb(255 255 255 / 0.08)' },
  'line-soft': { light: 'rgb(0 0 0 / 0.06)', dark: 'rgb(255 255 255 / 0.04)' },
  accent: { light: '#2563eb', dark: '#60a5fa' },
  'accent-soft': { light: '#dbeafe', dark: '#1e3a5f' },
  'on-accent': { light: '#ffffff', dark: '#07090c' },
  danger: { light: '#b91c1c', dark: '#ff4f58' },
  caution: { light: '#854d0e', dark: '#f5c842' },
  positive: { light: '#15803d', dark: '#4cd964' },
  'focus-ring': { light: '#2563eb', dark: '#60a5fa' },
  scrim: { light: 'rgb(15 23 42 / 0.4)', dark: 'rgb(0 0 0 / 0.6)' },
};

/** The portfolio's `landing-*` names, kept as aliases of the roles they always meant. */
export const LANDING_ALIASES: Readonly<Record<string, TColorRole>> = {
  'landing-bg': 'bg',
  'landing-bg-elev': 'bg-elevated',
  'landing-bg-card': 'bg-card',
  'landing-fg': 'fg',
  'landing-fg-dim': 'fg-dim',
  'landing-fg-faint': 'fg-faint',
  'landing-accent': 'accent',
  'landing-accent-dim': 'accent-soft',
  'landing-green': 'positive',
  'landing-red': 'danger',
  'landing-yellow': 'caution',
  'landing-border': 'line',
  'landing-border-soft': 'line-soft',
};
