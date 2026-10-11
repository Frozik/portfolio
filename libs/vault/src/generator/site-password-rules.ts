import { isNil } from 'lodash-es';
import { z } from 'zod';

import passwordRules from '../data/apple-password-manager-resources/password-rules.json';
import type { ICardState } from '../model/card';
import { allFields, fieldValues } from '../model/card';
import { loginHostOf } from '../model/domains';
import type { IPasswordRules } from './password-rules';
import { parsePasswordRules } from './password-rules';

const RULES_SCHEMA = z.record(z.string(), z.object({ 'password-rules': z.string() }));

let index: ReadonlyMap<string, string> | null = null;

function rulesIndex(): ReadonlyMap<string, string> {
  index ??= new Map(
    Object.entries(RULES_SCHEMA.parse(passwordRules)).map(([domain, entry]) => [
      domain,
      entry['password-rules'],
    ])
  );
  return index;
}

export interface ISitePasswordRules {
  readonly domain: string;
  readonly rules: IPasswordRules;
}

/** The rules Apple's list keeps for a host or the nearest domain above it. */
export function passwordRulesForHost(host: string): ISitePasswordRules | null {
  const labels = host.toLowerCase().split('.');
  for (let start = 0; start < labels.length - 1; start += 1) {
    const domain = labels.slice(start).join('.');
    const text = rulesIndex().get(domain);
    if (!isNil(text)) {
      return { domain, rules: parsePasswordRules(text) };
    }
  }
  return null;
}

/** The rules of the first address of the card that has any. */
export function passwordRulesOfCard(card: ICardState): ISitePasswordRules | null {
  for (const field of allFields(card)) {
    if (field.spec.kind !== 'url') {
      continue;
    }
    for (const url of fieldValues(field)) {
      const host = loginHostOf(url);
      const found = isNil(host) ? null : passwordRulesForHost(host);
      if (!isNil(found)) {
        return found;
      }
    }
  }
  return null;
}
