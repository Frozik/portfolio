export type TPluralForms = Partial<Record<Intl.LDMLPluralRule, string>>;

const pluralRulesByLocale = new Map<string, Intl.PluralRules>();

function getPluralRules(locale: string): Intl.PluralRules {
  const cached = pluralRulesByLocale.get(locale);
  if (cached !== undefined) {
    return cached;
  }
  const rules = new Intl.PluralRules(locale);
  pluralRulesByLocale.set(locale, rules);
  return rules;
}

/**
 * Picks the grammatically correct form of a word for `value` in any `locale`
 * via CLDR plural categories. `forms` only needs the categories the locale
 * uses (en: one/other; ru: one/few/many); any missing category falls back to
 * `other`. Callers supply the forms — irregular words (год/года/лет) can't be
 * derived automatically.
 */
export function selectPluralForm(locale: string, value: number, forms: TPluralForms): string {
  const category = getPluralRules(locale).select(value);
  return forms[category] ?? forms.other ?? '';
}
