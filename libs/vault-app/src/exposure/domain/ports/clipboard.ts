/** The system clipboard, as each platform lets an app write it. */
export interface IClipboard {
  /** `false` when the platform refused (no focus, no permission): the user simply copies again. */
  write(text: string): Promise<boolean>;
  /** Whether a write can happen now (a page needs focus). */
  canWrite(): boolean;
  /** Calls back once, the next time a write can happen. */
  onceWritable(listener: () => void): () => void;
  /** At a lock: clears now, or leaves the clearing to the process that comes after the lock. */
  clearNow(): void;
}
