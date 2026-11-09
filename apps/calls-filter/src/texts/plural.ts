import type { Language } from '@frozik/utils/i18n/language';

export type TPluralForms = Readonly<Partial<Record<Intl.LDMLPluralRule, string>>> & {
  readonly other: string;
};

const RULES = new Map<Language, Intl.PluralRules>();

/** The form of a word for a count, by the language's own plural rules. */
export function plural(language: Language, count: number, forms: TPluralForms): string {
  const rules = RULES.get(language) ?? new Intl.PluralRules(language);
  RULES.set(language, rules);
  return (forms[rules.select(count)] ?? forms.other).replace('#', String(count));
}
