import type { ICardState, IVaultCard } from '@frozik/vault/model/card';
import { searchCards } from '@frozik/vault/model/card-search';
import type { TCardSort } from '@frozik/vault/model/card-sort';
import { sortCards } from '@frozik/vault/model/card-sort';
import type { ICardClassification } from '@frozik/vault/model/classify-cards';
import { classifyCards, membersOf } from '@frozik/vault/model/classify-cards';
import type { TExpiryStatus } from '@frozik/vault/model/expiry';
import { expiryStatus, warningDaysFor } from '@frozik/vault/model/expiry';
import type { TCardId } from '@frozik/vault/model/ids';
import { rotationDueOn, rotationStatus } from '@frozik/vault/model/password-age';
import { iconDomainOf } from '@frozik/vault/model/site-icons';
import type {
  IUserSmartGroup,
  IUserTemplate,
  IVaultDocument,
} from '@frozik/vault/model/vault-document';
import { isNil, sortBy } from 'lodash-es';
import { makeAutoObservable, observableRef } from 'mobx';
import type { Temporal } from 'temporal-polyfill';

import type { TVaultSection } from '../../navigation/vault-pages';
import type { ISessionClock } from '../../session/domain/ports/session-clock';
import type { TSectionEntry } from './section-entries';
import { sectionEntriesOf } from './section-entries';
import type { TTemplateChoice } from './template-choices';
import { templateChoicesOf } from './template-choices';

export interface IRotationDue {
  readonly due: Temporal.PlainDate;
  readonly status: TExpiryStatus;
}

/** "expiring" and "expired" move with the date; a minute late at midnight is fine. */
const TODAY_REFRESH_MS = 60_000;

/**
 * What the list shows. The section comes from the URL
 * one way; the query never goes back to it (people paste passwords into
 * search). Every derivation is a computed delegating to the core.
 */
export class VaultView {
  query = '';
  sort: TCardSort = 'title';
  section: TVaultSection = 'all';
  today: Temporal.PlainDate;

  private readonly stopRefreshingToday: () => void;

  constructor(
    private readonly document: () => IVaultDocument,
    private readonly clock: ISessionClock,
    /** The members of "Problem passwords", from the session's audit. */
    private readonly auditProblems: () => ReadonlySet<TCardId> = () => new Set()
  ) {
    this.today = clock.today();
    makeAutoObservable<VaultView, 'document' | 'clock' | 'auditProblems' | 'stopRefreshingToday'>(
      this,
      {
        today: observableRef,
        document: false,
        clock: false,
        auditProblems: false,
        stopRefreshingToday: false,
      },
      { autoBind: true }
    );
    this.stopRefreshingToday = clock.every(TODAY_REFRESH_MS, () => this.setToday(clock.today()));
  }

  get classification(): ICardClassification {
    return classifyCards(this.document(), this.today, this.auditProblems());
  }

  get visibleCards(): readonly IVaultCard[] {
    const sorted = sortCards(membersOf(this.classification, this.section), this.sort, {
      favoritesFirst: true,
    });
    return searchCards(sorted, this.query);
  }

  /** The favourites, by title: a phone shows them in a strip above the list. */
  get favorites(): readonly IVaultCard[] {
    return sortCards(membersOf(this.classification, 'favorites'), 'title', {
      favoritesFirst: false,
    });
  }

  /** Counted against the same day as the "expiring" and "expired" sections. */
  expiryOf(card: IVaultCard): TExpiryStatus {
    return expiryStatus(card, this.today, warningDaysFor(card, this.document().settings));
  }

  /** When the card's passwords are due for a change, and how close that is; `null` without a period. */
  rotationOf(card: IVaultCard): IRotationDue | null {
    const due = rotationDueOn(card, this.today, this.clock.now());
    return isNil(due) ? null : { due, status: rotationStatus(due, this.today) };
  }

  /** The user's own smart groups for the sidebar, by name. */
  get userSmartGroups(): readonly IUserSmartGroup[] {
    return sortBy([...this.document().smartGroups.values()], group =>
      group.name.toLocaleLowerCase()
    );
  }

  /** Every section a list can show, with its count. */
  get sections(): readonly TSectionEntry[] {
    return sectionEntriesOf({
      countOf: this.countOf,
      smartGroups: this.userSmartGroups,
      groups: this.document().groups.values(),
    });
  }

  /** What a new card can start from: the built-in templates, then the user's own. */
  get templateChoices(): readonly TTemplateChoice[] {
    return templateChoicesOf(this.userTemplates);
  }

  /** The user's own templates for the "new card" menu, by name. */
  get userTemplates(): readonly IUserTemplate[] {
    return sortBy([...this.document().templates.values()], template =>
      template.name.toLocaleLowerCase()
    );
  }

  /** The icon of the card's site, when the vault has one. */
  siteIconOf(card: ICardState): Uint8Array<ArrayBuffer> | null {
    const domain = iconDomainOf(card);
    const icon = isNil(domain) ? undefined : this.document().siteIcons.get(domain);
    return icon?.kind === 'icon' ? icon.png : null;
  }

  countOf(section: TVaultSection): number {
    return membersOf(this.classification, section).length;
  }

  setQuery(query: string): void {
    this.query = query;
  }

  setSort(sort: TCardSort): void {
    this.sort = sort;
  }

  show(section: TVaultSection): void {
    this.section = section;
  }

  dispose(): void {
    this.stopRefreshingToday();
  }

  private setToday(today: Temporal.PlainDate): void {
    if (!today.equals(this.today)) {
      this.today = today;
    }
  }
}
