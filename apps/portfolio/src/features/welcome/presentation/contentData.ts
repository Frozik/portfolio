import type { TContactIconKey } from './components/contacts/ContactIcon';
import type { TProjectFxKind } from './components/projects/fx/types';

export interface IContactLink {
  readonly iconKey: TContactIconKey;
  readonly href: string;
  readonly qrValue?: string;
  readonly preferred?: boolean;
}

export interface IProjectRoute {
  readonly id: string;
  readonly route: string;
  readonly fx: TProjectFxKind;
}

export const CONTACT_LINKS: readonly IContactLink[] = [
  {
    iconKey: 'telegram',
    href: 'https://t.me/Frozik',
    qrValue: 'https://t.me/Frozik',
    preferred: true,
  },
  {
    iconKey: 'whatsapp',
    href: 'https://wa.me/79817151041',
    qrValue: 'https://wa.me/79817151041',
  },
  {
    iconKey: 'email',
    href: 'mailto:frozik@gmail.com',
  },
  {
    iconKey: 'github',
    href: 'https://github.com/frozik',
  },
  {
    iconKey: 'linkedin',
    href: 'https://linkedin.com/in/frozik',
  },
];

export const PROJECT_ROUTES: readonly IProjectRoute[] = [
  { id: 'pendulum', route: '/pendulum', fx: 'neural' },
  { id: 'sun', route: '/sun', fx: 'flare' },
  { id: 'graphics', route: '/graphics', fx: 'shapes' },
  { id: 'timeseries', route: '/timeseries', fx: 'crosshair' },
  { id: 'binance', route: '/binance', fx: 'ticker' },
  { id: 'sudoku', route: '/sudoku', fx: 'cursor' },
  { id: 'stereometry', route: '/stereometry', fx: 'rotate' },
  { id: 'retro', route: '/retro', fx: 'peers' },
  { id: 'conf', route: '/conf', fx: 'ar' },
  { id: 'controls', route: '/controls', fx: 'typing' },
];
