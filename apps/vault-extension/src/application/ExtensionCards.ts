import type { IVaultCard } from '@frozik/vault/model/card';
import { allFields, fieldValues } from '@frozik/vault/model/card';
import { searchCards } from '@frozik/vault/model/card-search';
import type { TCardId, TFieldId } from '@frozik/vault/model/ids';
import { parseOtpUri } from '@frozik/vault/model/validation/otpauth-uri';
import type { IVaultDocument } from '@frozik/vault/model/vault-document';
import { oneTimeCode } from '@frozik/vault/otp/one-time-code';
import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import type { ICardSummary, ICardView } from '../domain/card-views';
import { summaryOf, viewOf } from '../domain/card-views';
import type { TFillOutcome } from '../domain/messages';
import type { IExtensionServices, IFillRequest } from '../domain/ports';
import { cardServesPage, cardsForPage } from '../domain/site-cards';

const LOGIN_KINDS: ReadonlySet<string> = new Set(['login', 'email']);

function firstValue(card: IVaultCard, kinds: ReadonlySet<string>): string | null {
  const field = allFields(card).find(candidate => kinds.has(candidate.spec.kind));
  return isNil(field) ? null : (fieldValues(field)[0] ?? null);
}

/**
 * The open vault's cards as the popup asks for them: the page's, a search,
 * one card, a secret, a copy, a fill. A protected card's secrets leave only
 * while its window is open.
 */
export class ExtensionCards {
  constructor(
    private readonly services: Pick<
      IExtensionServices,
      'clipboard' | 'filler' | 'now' | 'protectedWindow'
    >,
    /** The open vault, or `null` while locked. */
    private readonly document: () => Promise<IVaultDocument | null>
  ) {}

  async pageCards(pageUrl: string): Promise<readonly ICardSummary[]> {
    const document = await this.document();
    return isNil(document)
      ? []
      : cardsForPage(document, pageUrl).map(({ card, match }) =>
          summaryOf(card, match === 'shared')
        );
  }

  async search(query: string): Promise<readonly ICardSummary[]> {
    const document = await this.document();
    if (isNil(document)) {
      return [];
    }
    const live = [...document.cards.values()].filter(
      card => isNil(card.archivedAt) && isNil(card.trashedAt)
    );
    return searchCards(live, query).map(card => summaryOf(card, false));
  }

  async card(cardId: TCardId): Promise<ICardView | null> {
    const card = await this.cardOf(cardId);
    return isNil(card) ? null : viewOf(card);
  }

  async reveal(cardId: TCardId, fieldId: TFieldId): Promise<string | null> {
    const card = await this.secretsOf(cardId);
    const field = isNil(card) ? undefined : allFields(card).find(entry => entry.id === fieldId);
    return isNil(field) ? null : fieldValues(field).join('\n');
  }

  async copy(cardId: TCardId, fieldId: TFieldId): Promise<boolean> {
    const value = await this.reveal(cardId, fieldId);
    return isNil(value) ? false : this.services.clipboard.copy(value);
  }

  /** The current code of a TOTP field; HOTP stays with the web app, which owns its counter. */
  async copyCode(cardId: TCardId, fieldId: TFieldId): Promise<boolean> {
    const code = await this.codeOf(cardId, fieldId);
    return isNil(code) ? false : this.services.clipboard.copy(code);
  }

  /** Login, password and the current code, for a page the card's addresses allow. */
  async fill(
    cardId: TCardId,
    tabId: number,
    pageUrl: string,
    allowInsecure: boolean
  ): Promise<TFillOutcome> {
    const card = await this.secretsOf(cardId);
    if (isNil(card)) {
      return isNil(await this.document()) ? 'locked' : 'not-allowed';
    }
    if (!cardServesPage(card, pageUrl)) {
      return 'other-site';
    }
    const otpField = allFields(card).find(field => field.spec.kind === 'otp');
    const request: IFillRequest = {
      username: firstValue(card, LOGIN_KINDS),
      password: firstValue(card, new Set(['password'])),
      otp: isNil(otpField) ? null : await this.codeOf(card.id, otpField.id),
      addresses: allFields(card).flatMap(field => {
        const { spec } = field;
        return spec.kind === 'url' ? fieldValues(field).map(stored => ({ stored, spec })) : [];
      }),
      allowInsecure,
    };
    return this.services.filler.fill(tabId, request);
  }

  private async codeOf(cardId: TCardId, fieldId: TFieldId): Promise<string | null> {
    const uri = await this.reveal(cardId, fieldId);
    const params = isNil(uri) ? null : parseOtpUri(uri);
    if (isNil(params) || !params.ok || params.value.type !== 'totp') {
      return null;
    }
    const code = await oneTimeCode(params.value, {
      kind: 'time',
      at: Temporal.Instant.fromEpochMilliseconds(this.services.now()),
    });
    return code.ok ? code.value.code : null;
  }

  private async cardOf(cardId: TCardId): Promise<IVaultCard | null> {
    const card = (await this.document())?.cards.get(cardId);
    return isNil(card) || !isNil(card.trashedAt) ? null : card;
  }

  /** A card whose secrets may leave the worker now: a protected one only while it is open. */
  private async secretsOf(cardId: TCardId): Promise<IVaultCard | null> {
    const card = await this.cardOf(cardId);
    if (isNil(card)) {
      return null;
    }
    if (!card.protected) {
      return card;
    }
    return this.services.now() < (await this.services.protectedWindow.load()) ? card : null;
  }
}
