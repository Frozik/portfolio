import { isNil } from 'lodash-es';
import { makeAutoObservable, runInAction } from 'mobx';

import type { ISessionClock } from '../../session/domain/ports/session-clock';
import type { IClipboard } from '../domain/ports/clipboard';

/**
 * A copied secret is wiped after a while. The page cannot
 * read the clipboard without asking, so it cannot tell whether the copy is
 * still there: it clears unconditionally, and only with focus, which the
 * write needs; without focus the clearing waits for the focus to return.
 */
export class ClipboardGuard {
  /** Epoch milliseconds when the last copy is cleared, for the "clears in 30 s" announcement. */
  clearsAt: number | null = null;

  private cancelPending: (() => void) | null = null;

  constructor(
    private readonly clipboard: IClipboard,
    private readonly clock: ISessionClock,
    private readonly clearAfter: () => number
  ) {
    makeAutoObservable<ClipboardGuard, 'clipboard' | 'clock' | 'cancelPending' | 'clearAfter'>(
      this,
      { clipboard: false, clock: false, clearAfter: false, cancelPending: false },
      { autoBind: true }
    );
  }

  /** The setting as it is now; a change applies to the next copy. */
  get clearAfterMs(): number {
    return this.clearAfter();
  }

  async copy(text: string): Promise<boolean> {
    const written = await this.clipboard.write(text);
    runInAction(() => {
      if (!written) {
        return;
      }
      this.cancelPending?.();
      this.clearsAt = this.clock.now() + this.clearAfterMs;
      this.cancelPending = this.clock.after(this.clearAfterMs, this.clear);
    });
    return written;
  }

  /** On lock a pending copy is cleared now, or by the process after the lock. */
  flush(): void {
    if (isNil(this.cancelPending)) {
      return;
    }
    this.dispose();
    this.clipboard.clearNow();
  }

  dispose(): void {
    this.cancelPending?.();
    this.cancelPending = null;
    this.clearsAt = null;
  }

  private clear(): void {
    this.cancelPending?.();
    if (!this.clipboard.canWrite()) {
      this.cancelPending = this.clipboard.onceWritable(this.clear);
      return;
    }
    this.cancelPending = null;
    this.clearsAt = null;
    void this.clipboard.write('');
  }
}
