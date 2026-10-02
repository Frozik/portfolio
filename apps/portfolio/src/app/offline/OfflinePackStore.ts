import { makeAutoObservable } from 'mobx';

import type { TOfflinePackStatus } from '../../sw/offline-pack-protocol';
import type { IOfflinePackPort } from './offlinePackPort';

export class OfflinePackStore {
  /** `null` until the worker answers — also forever, where there is no worker. */
  status: TOfflinePackStatus | null = null;

  private readonly unsubscribe: () => void;

  constructor(
    private readonly port: IOfflinePackPort,
    /** Whether the pack downloads by itself (the installed app) or only on request (a browser tab). */
    public automatic: boolean
  ) {
    makeAutoObservable<OfflinePackStore, 'port' | 'unsubscribe'>(
      this,
      { port: false, unsubscribe: false },
      { autoBind: true }
    );
    this.unsubscribe = port.subscribe(this.receiveStatus);
    port.requestStatus();
  }

  download(): void {
    this.port.requestWarm();
  }

  /** The visitor installed the app from this very tab: from now on the pack keeps itself up to date. */
  markInstalled(): void {
    this.automatic = true;
    this.download();
  }

  /** A worker stopped mid-download never sends a final status; asking again shows the truth. */
  refresh(): void {
    this.port.requestStatus();
  }

  dispose(): void {
    this.unsubscribe();
  }

  private receiveStatus(status: TOfflinePackStatus): void {
    this.status = status;
  }
}
