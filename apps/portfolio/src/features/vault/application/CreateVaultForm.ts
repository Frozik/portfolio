import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';

import type { IPasswordStrength, TMasterPasswordProblem } from '../domain/master-password';
import { masterPasswordProblem } from '../domain/master-password';
import type { ISessionClock } from '../domain/ports/session-clock';
import type { IStrengthMeter } from '../domain/ports/strength-meter';

/** Typing pauses this long before the Worker is asked again. */
export const STRENGTH_DEBOUNCE_MS = 250;

/** The "create a vault" form: never a `<form>` the browser could post. */
export class CreateVaultForm {
  name = '';
  description = '';
  password = '';
  confirmation = '';
  acknowledged = false;
  strength: IPasswordStrength | null = null;

  private pending: {
    readonly cancelTimer: () => void;
    readonly controller: AbortController;
  } | null = null;

  constructor(
    private readonly meter: IStrengthMeter,
    private readonly clock: ISessionClock
  ) {
    makeAutoObservable<CreateVaultForm, 'meter' | 'clock' | 'pending'>(
      this,
      { strength: observableRef, meter: false, clock: false, pending: false },
      { autoBind: true }
    );
  }

  get problem(): TMasterPasswordProblem | 'no-name' | null {
    return this.name.trim() === '' ? 'no-name' : masterPasswordProblem(this);
  }

  setName(name: string): void {
    this.name = name;
  }

  setDescription(description: string): void {
    this.description = description;
  }

  setPassword(password: string): void {
    this.password = password;
    this.estimate();
  }

  setConfirmation(confirmation: string): void {
    this.confirmation = confirmation;
  }

  setAcknowledged(acknowledged: boolean): void {
    this.acknowledged = acknowledged;
  }

  /** Hands the password over once and forgets it here; `null` while something still blocks creating. */
  take(): {
    readonly name: string;
    readonly description: string;
    readonly password: string;
  } | null {
    if (!isNil(this.problem)) {
      return null;
    }
    const taken = {
      name: this.name.trim(),
      description: this.description.trim(),
      password: this.password,
    };
    this.password = '';
    this.confirmation = '';
    this.strength = null;
    this.cancelPending();
    return taken;
  }

  dispose(): void {
    this.cancelPending();
    this.meter.dispose();
  }

  private estimate(): void {
    this.cancelPending();
    if (this.password === '') {
      this.strength = null;
      return;
    }
    const controller = new AbortController();
    const cancelTimer = this.clock.after(STRENGTH_DEBOUNCE_MS, () => {
      void this.meter.estimate(this.password, [this.name], controller.signal).then(strength => {
        if (!controller.signal.aborted) {
          runInAction(() => {
            this.strength = strength;
          });
        }
      });
    });
    this.pending = { cancelTimer, controller };
  }

  private cancelPending(): void {
    this.pending?.cancelTimer();
    this.pending?.controller.abort();
    this.pending = null;
  }
}
