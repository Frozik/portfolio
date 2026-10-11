import { makeAutoObservable } from 'mobx';

import type { ISessionClock } from '../domain/ports/session-clock';

/** Once the password is entered again, protected cards stay open this long, vault-wide. */
export const PROTECTED_WINDOW_MS = 5 * 60_000;

/** Whether protected cards show their secrets; the session opens it after checking the password. */
export class ProtectedGateModel {
  isOpen = false;

  private cancelClose: (() => void) | null = null;

  constructor(private readonly clock: ISessionClock) {
    makeAutoObservable<ProtectedGateModel, 'clock' | 'cancelClose'>(
      this,
      { clock: false, cancelClose: false },
      { autoBind: true }
    );
  }

  open(): void {
    this.cancelClose?.();
    this.isOpen = true;
    this.cancelClose = this.clock.after(PROTECTED_WINDOW_MS, this.close);
  }

  close(): void {
    this.cancelClose?.();
    this.cancelClose = null;
    this.isOpen = false;
  }

  dispose(): void {
    this.close();
  }
}
