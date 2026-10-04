import type { ISO } from '@frozik/utils/date/types';

export type TBreadcrumbCategory =
  | 'ui.click'
  | 'ui.input'
  | 'navigation'
  | 'http'
  | 'visibility'
  | 'connectivity';

export type TBreadcrumbLevel = 'info' | 'warning' | 'error';

export interface IBreadcrumb {
  readonly timestamp: ISO;
  readonly category: TBreadcrumbCategory;
  readonly level: TBreadcrumbLevel;
  readonly message: string;
  readonly data: Readonly<Record<string, string | number | boolean>>;
}

export interface IElementFacts {
  readonly tag: string;
  readonly id: string;
  readonly classes: readonly string[];
  readonly testId: string;
  readonly ariaLabel: string;
  readonly role: string;
  readonly text: string;
}

const MAX_TEXT = 40;
const MAX_CLASSES = 2;

/** Describes an element the way a human would point at it: the most stable handle first, the text last. */
export function describeElement(facts: IElementFacts): string {
  const tag = facts.tag.toLowerCase();
  if (facts.testId !== '') {
    return `${tag}[data-testid="${facts.testId}"]`;
  }
  if (facts.id !== '') {
    return `${tag}#${facts.id}`;
  }
  if (facts.ariaLabel !== '') {
    return `${tag}[aria-label="${truncate(facts.ariaLabel)}"]`;
  }
  const role = facts.role === '' ? '' : `[role=${facts.role}]`;
  const classes = facts.classes
    .slice(0, MAX_CLASSES)
    .map(className => `.${className}`)
    .join('');
  const text = facts.text.trim();
  const label = text === '' ? '' : ` "${truncate(text)}"`;
  return `${tag}${role}${classes}${label}`;
}

function truncate(text: string): string {
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text;
}
