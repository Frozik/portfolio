import { action, computed, makeObservable, observableRef, runInAction } from 'mobx';

import type { TPermissionStep } from '../domain/permission-steps';
import { missingSteps } from '../domain/permission-steps';
import type { TOpenSystemSettings, TSettingsPlace } from '../domain/ports/system-settings';
import type { DeviceModel } from './DeviceModel';

/** What the user's setup needs beyond the basics, from the groups. */
export interface IPermissionNeeds {
  readonly usesDeviceCalendars: boolean;
  readonly usesAutoReply: boolean;
  readonly usesPlaces: boolean;
}

function settingsPlace(step: TPermissionStep): TSettingsPlace {
  if (step === 'screening-role') {
    return 'default-apps';
  }
  return step === 'notifications' ? 'notifications' : 'app-permissions';
}

/**
 * Asks for what is missing, one thing at a time: the system's own dialog first; once Android
 * stops showing it, the place in Settings. Coming back to the app re-reads the phone, so a
 * granted step leaves by itself and the next one shows.
 */
export class PermissionPrompt {
  /** Put off until the app starts again. */
  private skipped: ReadonlySet<TPermissionStep> = new Set();
  /** Asked for and refused: only Settings can grant them now. */
  private refused: ReadonlySet<TPermissionStep> = new Set();

  constructor(
    private readonly device: DeviceModel,
    private readonly needs: () => IPermissionNeeds,
    private readonly openSettingsAt: TOpenSystemSettings
  ) {
    makeObservable<PermissionPrompt, 'skipped' | 'refused'>(this, {
      skipped: observableRef,
      refused: observableRef,
      step: computed,
      needsSettings: computed,
      later: action,
    });
  }

  get step(): TPermissionStep | null {
    const { holdsRole, permissions } = this.device;
    const missing = missingSteps({ holdsRole, permissions, ...this.needs() });
    return missing.find(step => !this.skipped.has(step)) ?? null;
  }

  /** The system's dialog was refused: the button leads to Settings instead. */
  get needsSettings(): boolean {
    return this.step !== null && this.refused.has(this.step);
  }

  async allow(): Promise<void> {
    const { step } = this;
    if (step === null) {
      return;
    }
    if (this.needsSettings) {
      this.openSettingsAt(settingsPlace(step));
      return;
    }
    const granted =
      step === 'screening-role'
        ? await this.device.requestRole()
        : (await this.device.request(step)) === 'granted';
    if (!granted) {
      runInAction(() => {
        this.refused = new Set([...this.refused, step]);
      });
    }
  }

  later(): void {
    if (this.step !== null) {
      this.skipped = new Set([...this.skipped, this.step]);
    }
  }
}
