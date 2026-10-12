import { toBase64Url } from '@frozik/vault/crypto/bytes';
import type { TUnlockFailure } from '@frozik/vault/lifecycle/lifecycle-state';
import type { IHostDisplay } from '@frozik/vault/model/host-display';
import { describeHost } from '@frozik/vault/model/host-display';
import type { TCardId, TFieldId } from '@frozik/vault/model/ids';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observable, observableRef, runInAction } from 'mobx';

import type { TDriveSpace } from '@frozik/cloud-storage/google-drive/drive-space';
import type { ICardSummary, ICardView } from '../domain/card-views';

import type { IDriveSource, IWebDavSource, TConnectOutcome, TDriveSearch } from '../domain/cloud';
import type { TExtensionStatus, TFillOutcome } from '../domain/messages';
import type { IActiveTab, TAskWorker } from '../domain/ports';

/** What the popup says after an action: a fill's result, a refused password, a copy done. */
export type TPopupNotice =
  | { readonly kind: 'fill'; readonly outcome: TFillOutcome }
  | { readonly kind: 'unlock-failed'; readonly failure: TUnlockFailure }
  | { readonly kind: 'copied' }
  | { readonly kind: 'file-refused' }
  | { readonly kind: 'connect-failed'; readonly outcome: Exclude<TConnectOutcome, 'connected'> }
  | { readonly kind: 'host-refused' };

/**
 * The popup: lives while it is open, holds nothing secret
 * but a field the user asked to see, asks the worker for everything else.
 */
export class PopupModel {
  status: TExtensionStatus | null = null;
  tab: IActiveTab | null = null;
  pageCards: readonly ICardSummary[] = [];
  query = '';
  results: readonly ICardSummary[] = [];
  opened: ICardView | null = null;
  notice: TPopupNotice | null = null;
  busy = false;
  /** The fill waits for a yes: the page is plain HTTP. */
  confirmingInsecure = false;
  driveSearch: TDriveSearch | null = null;
  /** The pull found Google's token gone and could not renew it without a window. */
  signInNeeded = false;
  /** The reset waits for a yes: it drops the extension's copy of the vault. */
  confirmingReset = false;
  readonly revealed = observable.map<TFieldId, string>();

  constructor(
    private readonly ask: TAskWorker,
    private readonly activeTab: () => Promise<IActiveTab | null>,
    /** The WebDAV host, asked for within the click that connects. */
    private readonly requestHost: (url: string) => Promise<boolean>,
    /** The popup (or its tab) closes once its work is done: after a fill, after the lock. */
    private readonly close: () => void,
    /**
     * The popup opened as a tab, for Google's sign-in: the popup itself closes
     * as Google's window takes focus. `null` in that tab.
     */
    readonly openInTab: (() => void) | null
  ) {
    makeAutoObservable<PopupModel, 'ask' | 'activeTab' | 'requestHost' | 'close'>(
      this,
      {
        status: observableRef,
        pageCards: observableRef,
        results: observableRef,
        opened: observableRef,
        notice: observableRef,
        driveSearch: observableRef,
        openInTab: false,
        ask: false,
        activeTab: false,
        requestHost: false,
        close: false,
      },
      { autoBind: true }
    );
  }

  get vaultName(): string | null {
    const { status } = this;
    return isNil(status) || status.kind === 'not-set-up' ? null : status.vaultName;
  }

  /** The popup opened as a tab: Google Drive's setup, not the cards of a page. */
  get inTab(): boolean {
    return isNil(this.openInTab);
  }

  /** The tab's work is done once the vault is connected and opens. */
  closeTab(): void {
    this.close();
  }

  /** The page's host in the header, punycode beside a host that has other letters. */
  get host(): IHostDisplay | null {
    return isNil(this.tab) ? null : describeHost(this.tab.url);
  }

  async start(): Promise<void> {
    const [status, tab] = await Promise.all([this.ask({ kind: 'status' }), this.activeTab()]);
    runInAction(() => {
      this.status = status;
      this.tab = tab;
    });
    await this.loadPageCards();
  }

  async openFile(file: Uint8Array<ArrayBuffer>, name: string): Promise<void> {
    const opened = await this.ask({ kind: 'open-file', file: toBase64Url(file), name });
    runInAction(() => {
      this.notice = opened.ok ? null : { kind: 'file-refused' };
    });
    await this.start();
  }

  /** Must be called from the click: Chrome grants the host only within the gesture. */
  async connectWebDav(source: IWebDavSource, password: string): Promise<void> {
    if (!(await this.requestHost(source.folderUrl))) {
      runInAction(() => {
        this.notice = { kind: 'host-refused' };
      });
      return;
    }
    runInAction(() => {
      this.busy = true;
    });
    const outcome = await this.ask({ kind: 'connect-webdav', source, password });
    runInAction(() => {
      this.busy = false;
      this.notice = outcome === 'connected' ? null : { kind: 'connect-failed', outcome };
    });
    await this.start();
  }

  /** Google's window, then the vault files in the folder; one of them is chosen next. */
  async findDriveVaults(space: TDriveSpace, folder: string): Promise<void> {
    this.busy = true;
    this.driveSearch = null;
    const search = await this.ask({ kind: 'find-drive-vaults', space, folder });
    runInAction(() => {
      this.busy = false;
      this.driveSearch = search;
    });
  }

  async connectDrive(source: IDriveSource): Promise<void> {
    this.busy = true;
    const outcome = await this.ask({ kind: 'connect-drive', source });
    runInAction(() => {
      this.busy = false;
      this.notice = outcome === 'connected' ? null : { kind: 'connect-failed', outcome };
    });
    await this.start();
  }

  /** The worker opens Google's window; the popup closes behind it, the next one finds the vault pulled. */
  async signInToDrive(): Promise<void> {
    await this.ask({ kind: 'drive-sign-in' });
    await this.start();
  }

  async unlock(password: string): Promise<void> {
    this.busy = true;
    const failure = await this.ask({ kind: 'unlock', password });
    runInAction(() => {
      this.busy = false;
      this.notice = isNil(failure) ? null : { kind: 'unlock-failed', failure };
    });
    if (isNil(failure)) {
      await this.start();
    }
  }

  async lock(): Promise<void> {
    await this.ask({ kind: 'lock' });
    this.close();
  }

  askToReset(): void {
    this.confirmingReset = true;
  }

  cancelReset(): void {
    this.confirmingReset = false;
  }

  /** The worker forgets the vault and reloads, which closes the popup; the next one offers the setup. */
  async reset(): Promise<void> {
    this.confirmingReset = false;
    await this.ask({ kind: 'reset' });
    this.close();
  }

  async search(query: string): Promise<void> {
    this.query = query;
    const results = query.trim() === '' ? [] : await this.ask({ kind: 'search', query });
    runInAction(() => {
      if (this.query === query) {
        this.results = results;
      }
    });
  }

  async open(cardId: TCardId): Promise<void> {
    const card = await this.ask({ kind: 'card', cardId });
    runInAction(() => {
      this.opened = card;
      this.revealed.clear();
      this.notice = null;
      this.confirmingInsecure = false;
    });
  }

  back(): void {
    this.opened = null;
    this.revealed.clear();
    this.notice = null;
  }

  async reveal(fieldId: TFieldId): Promise<void> {
    const card = this.opened;
    if (isNil(card)) {
      return;
    }
    const value = await this.ask({ kind: 'reveal', cardId: card.id, fieldId });
    runInAction(() => {
      if (!isNil(value)) {
        this.revealed.set(fieldId, value);
      }
    });
  }

  hide(fieldId: TFieldId): void {
    this.revealed.delete(fieldId);
  }

  async copy(fieldId: TFieldId, code = false): Promise<void> {
    const card = this.opened;
    if (isNil(card)) {
      return;
    }
    const copied = await this.ask({
      kind: code ? 'copy-code' : 'copy',
      cardId: card.id,
      fieldId,
    });
    runInAction(() => {
      this.notice = copied ? { kind: 'copied' } : null;
    });
  }

  async openProtected(password: string): Promise<TUnlockFailure | null> {
    return this.ask({ kind: 'open-protected', password });
  }

  /** A plain-HTTP page fills only after the user says yes here. */
  async fill(allowInsecure = false): Promise<void> {
    const { opened, tab } = this;
    if (isNil(opened) || isNil(tab)) {
      return;
    }
    const outcome = await this.ask({
      kind: 'fill',
      cardId: opened.id,
      tabId: tab.id,
      pageUrl: tab.url,
      allowInsecure,
    });
    runInAction(() => {
      this.confirmingInsecure = outcome === 'insecure-page' && !allowInsecure;
      this.notice = this.confirmingInsecure ? null : { kind: 'fill', outcome };
    });
    if (outcome === 'filled') {
      this.close();
    }
  }

  /** The popup opening is a pull: the cloud file may have changed meanwhile. */
  private async loadPageCards(): Promise<void> {
    const { tab, status } = this;
    if (status?.kind !== 'unlocked') {
      return;
    }
    const pulled = await this.ask({ kind: 'sync' });
    runInAction(() => {
      this.signInNeeded = pulled === 'signed-out';
    });
    if (pulled === 'rotated') {
      const locked = await this.ask({ kind: 'status' });
      runInAction(() => {
        this.status = locked;
      });
      return;
    }
    if (isNil(tab)) {
      return;
    }
    const cards = await this.ask({ kind: 'page-cards', pageUrl: tab.url });
    runInAction(() => {
      this.pageCards = cards;
    });
    const [single] = cards;
    if (cards.length === 1 && !isNil(single)) {
      await this.open(single.id);
    }
  }
}
