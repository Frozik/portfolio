import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef } from 'mobx';

import { TOAST_AUTOCLEAR_MS } from '../domain/constants';

export interface IToast {
  readonly id: string;
  readonly message: string;
}

/** One transient message at a time; a newer one replaces the current and restarts the auto-clear. */
export class ToastModel {
  current: IToast | undefined = undefined;

  private timeoutId: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    makeAutoObservable<ToastModel, 'timeoutId'>(
      this,
      { current: observableRef, timeoutId: false },
      { autoBind: true }
    );
  }

  show(message: string): void {
    this.cancelAutoClear();
    this.current = { id: crypto.randomUUID(), message };
    this.timeoutId = setTimeout(this.clear, TOAST_AUTOCLEAR_MS);
  }

  clear(): void {
    this.cancelAutoClear();
    this.current = undefined;
  }

  dispose(): void {
    this.cancelAutoClear();
  }

  private cancelAutoClear(): void {
    if (!isNil(this.timeoutId)) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }
}
