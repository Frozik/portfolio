import type { ReactNode } from 'react';
import type { Temporal } from 'temporal-polyfill';

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
