import type { TTemplateId } from '../ids';
import { BANK_ACCOUNT_TEMPLATE } from './bank-account';
import { BANK_ACCOUNT_RU_TEMPLATE } from './bank-account-ru';
import { BANK_ACCOUNT_UK_TEMPLATE } from './bank-account-uk';
import { BANK_ACCOUNT_US_TEMPLATE } from './bank-account-us';
import { BANK_CARD_TEMPLATE } from './bank-card';
import { BLANK_TEMPLATE } from './blank';
import { DOCUMENT_TEMPLATE } from './document';
import { EMAIL_ACCOUNT_TEMPLATE } from './email-account';
import { INTERNET_ACCOUNT_TEMPLATE } from './internet-account';
import { NOTE_TEMPLATE } from './note';
import { SERVER_TEMPLATE } from './server';
import type { ICardTemplate } from './template';
import { WIFI_TEMPLATE } from './wifi';

/** In the order the "new card" menu shows them. */
export const BUILTIN_TEMPLATES: readonly ICardTemplate[] = [
  INTERNET_ACCOUNT_TEMPLATE,
  BANK_CARD_TEMPLATE,
  BANK_ACCOUNT_TEMPLATE,
  BANK_ACCOUNT_US_TEMPLATE,
  BANK_ACCOUNT_UK_TEMPLATE,
  BANK_ACCOUNT_RU_TEMPLATE,
  EMAIL_ACCOUNT_TEMPLATE,
  WIFI_TEMPLATE,
  DOCUMENT_TEMPLATE,
  SERVER_TEMPLATE,
  NOTE_TEMPLATE,
  BLANK_TEMPLATE,
];

const BY_ID: ReadonlyMap<TTemplateId, ICardTemplate> = new Map(
  BUILTIN_TEMPLATES.map(template => [template.id, template])
);

/** A card of an unknown template (a newer version's) behaves as a blank one. */
export function templateOf(id: TTemplateId): ICardTemplate {
  return BY_ID.get(id) ?? BLANK_TEMPLATE;
}
