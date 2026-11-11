import type { IVaultCard } from '@frozik/vault/model/card';
import { allFields, fieldValues } from '@frozik/vault/model/card';
import { cardSubtitle } from '@frozik/vault/model/card-subtitle';
import type { TExpiryStatus } from '@frozik/vault/model/expiry';

/** One row of a list: never a secret — the login, or `•••• 1234` of a card number. */
export interface ICardRow {
  readonly card: IVaultCard;
  readonly subtitle: string | null;
  /** Shown only when it calls for attention: soon or already expired. */
  readonly expiry: 'soon' | 'expired' | null;
  readonly hasOneTimeCode: boolean;
  /** Files are attached: a paper clip after the title. */
  readonly hasFiles: boolean;
}

export function cardRowOf(card: IVaultCard, expiry: TExpiryStatus): ICardRow {
  return {
    card,
    subtitle: cardSubtitle(card),
    expiry: expiry === 'soon' || expiry === 'expired' ? expiry : null,
    hasOneTimeCode: allFields(card).some(field => field.spec.kind === 'otp'),
    hasFiles: allFields(card).some(
      field => field.spec.kind === 'file' && fieldValues(field).length > 0
    ),
  };
}
