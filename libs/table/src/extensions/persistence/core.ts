import { isEqual, isNil } from 'lodash-es';
import { makeAutoObservable, reaction } from 'mobx';

import { DisposableBag } from '@frozik/utils/disposable/DisposableBag';

import type { IExtensionInstance, ITableExtension } from '../../core/kernel/extension';
import type { ITableKernel } from '../../core/kernel/kernel';
import type { ITableState } from '../../core/state/table-state';
import { decodeState, encodeState } from './codec';

export interface IStoredState {
  readonly version: number;
  readonly state: ITableState;
}

/** Where a table's state lives between visits: the application decides (local storage, a server, memory). */
export interface IStateStorage {
  load(tableId: string): IStoredState | undefined | Promise<IStoredState | undefined>;
  save(tableId: string, stored: IStoredState): void;
  remove(tableId: string): void;
}

/** The address bar, so a view can be shared as a link; the application owns the router. */
export interface IUrlPort {
  read(parameter: string): string | undefined;
  write(parameter: string, value: string | undefined): void;
  hrefWith(parameter: string, value: string): string;
}

export interface IPersistenceOptions {
  readonly storage: IStateStorage;
  readonly url?: { readonly port: IUrlPort; readonly parameter?: string };
  /** Bump when the persisted shape stops matching the columns; older states are ignored. */
  readonly version?: number;
  readonly saveDebounceMs?: number;
}

export interface IPersistenceSlice {
  readonly restored: boolean;
  /** The current state as a token another visit can apply. */
  share(): string;
  shareLink(): string | undefined;
  applyShared(token: string): boolean;
  forget(): void;
}

const DEFAULT_PARAMETER = 'tableState';
const DEFAULT_VERSION = 1;
const DEFAULT_SAVE_DEBOUNCE_MS = 500;

class PersistenceSlice<TRow> implements IPersistenceSlice {
  restored = false;
  private readonly disposers = new DisposableBag();
  private readonly version: number;
  private readonly parameter: string;

  constructor(
    private readonly kernel: ITableKernel<TRow, unknown>,
    private readonly options: IPersistenceOptions
  ) {
    this.version = options.version ?? DEFAULT_VERSION;
    this.parameter = options.url?.parameter ?? DEFAULT_PARAMETER;
    makeAutoObservable<
      PersistenceSlice<TRow>,
      'kernel' | 'options' | 'disposers' | 'version' | 'parameter'
    >(
      this,
      {
        kernel: false,
        options: false,
        disposers: false,
        version: false,
        parameter: false,
        share: false,
        shareLink: false,
      },
      { autoBind: true }
    );
  }

  start(): void {
    const tableId = this.kernel.id;
    if (isNil(tableId)) {
      return;
    }
    if (!this.applyFromUrl()) {
      this.restoreFrom(tableId);
    }
    this.disposers.add(
      reaction(
        () => this.kernel.state,
        state => {
          if (this.restored) {
            this.options.storage.save(tableId, { version: this.version, state });
          }
        },
        {
          delay: this.options.saveDebounceMs ?? DEFAULT_SAVE_DEBOUNCE_MS,
          equals: isEqual,
        }
      )
    );
  }

  share(): string {
    return encodeState(this.kernel.state, this.version);
  }

  shareLink(): string | undefined {
    return this.options.url?.port.hrefWith(this.parameter, this.share());
  }

  applyShared(token: string): boolean {
    const state = decodeState(token, this.version);
    if (state === undefined) {
      return false;
    }
    this.kernel.applyState(state);
    this.restored = true;
    return true;
  }

  forget(): void {
    if (!isNil(this.kernel.id)) {
      this.options.storage.remove(this.kernel.id);
    }
    this.kernel.resetState();
  }

  dispose(): void {
    this.disposers.disposeAll();
  }

  private applyFromUrl(): boolean {
    const url = this.options.url;
    if (url === undefined) {
      return false;
    }
    const token = url.port.read(this.parameter);
    if (token === undefined) {
      return false;
    }
    const applied = this.applyShared(token);
    url.port.write(this.parameter, undefined);
    return applied;
  }

  private restoreFrom(tableId: string): void {
    const loaded = this.options.storage.load(tableId);
    if (loaded instanceof Promise) {
      void loaded.then(this.applyRestored);
      return;
    }
    this.applyRestored(loaded);
  }

  private applyRestored(stored: IStoredState | undefined): void {
    if (stored !== undefined && stored.version === this.version) {
      this.kernel.applyState(stored.state);
    }
    this.restored = true;
  }
}

/** Keeps the table's state across visits and turns it into a shareable link; needs a table `id`. */
export function persistence<TRow = never>(
  options: IPersistenceOptions
): ITableExtension<TRow, 'persistence', IPersistenceSlice> {
  return {
    id: 'persistence',
    create(kernel): IExtensionInstance<TRow, IPersistenceSlice> {
      const slice = new PersistenceSlice(kernel, options);
      slice.start();
      return { slice, dispose: slice.dispose };
    },
  };
}
