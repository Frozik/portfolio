import type { Milliseconds } from '@frozik/utils/date/types';
import type { TUnlockFailure } from '@frozik/vault/session/unlock-failure';
import { isNil } from 'lodash-es';
import { makeAutoObservable, runInAction } from 'mobx';

import type { IDeviceSettings } from '../../device/domain/device-settings';
import type { ISessionClock } from '../../session/domain/ports/session-clock';
import { reminderDue } from '../domain/reminder';

export type TReminderState =
  | { readonly kind: 'quiet' }
  | { readonly kind: 'due'; readonly failure: TUnlockFailure | null }
  | { readonly kind: 'checking' };

export interface IReminderServices {
  readonly check: (password: string) => Promise<TUnlockFailure | null>;
  readonly settings: {
    readonly settings: IDeviceSettings;
    loaded(): Promise<void>;
    update(change: Partial<IDeviceSettings>): void;
  };
  readonly clock: ISessionClock;
}

/**
 * The weekly master-password reminder: a dialog after an unlock that did not
 * use the password, never a lock. Dismissed, it asks again at the next
 * unlock; the password typed right, here or at an unlock, starts the week over.
 */
export class ReminderModel {
  state: TReminderState = { kind: 'quiet' };

  constructor(private readonly services: IReminderServices) {
    makeAutoObservable<ReminderModel, 'services'>(this, { services: false }, { autoBind: true });
  }

  /** At the session's start: the password typed now starts the week over; otherwise is the week up? */
  async start(masterTyped: boolean): Promise<void> {
    const { settings, clock } = this.services;
    await settings.loaded();
    if (masterTyped) {
      settings.update({ lastMasterAt: clock.now() as Milliseconds });
      return;
    }
    runInAction(() => {
      this.state = reminderDue(settings.settings.lastMasterAt, clock.now())
        ? { kind: 'due', failure: null }
        : { kind: 'quiet' };
    });
  }

  dismiss(): void {
    this.state = { kind: 'quiet' };
  }

  async submit(password: string): Promise<void> {
    if (this.state.kind !== 'due' || password === '') {
      return;
    }
    this.state = { kind: 'checking' };
    const failure = await this.services.check(password);
    runInAction(() => {
      if (isNil(failure)) {
        this.services.settings.update({ lastMasterAt: this.services.clock.now() as Milliseconds });
        this.state = { kind: 'quiet' };
      } else {
        this.state = { kind: 'due', failure };
      }
    });
  }
}
