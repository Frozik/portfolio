export type FileSinkStrategy = 'file-system-access' | 'stream-saver' | 'blob-download';

export interface FileSinkType {
  readonly description: string;
  readonly mime: string;
  readonly extension: string;
}

export interface FileSinkOptions {
  readonly name: string;
  /** Offered to the save dialog as the file's type; absent, the dialog applies no filter. */
  readonly type?: FileSinkType;
  /** Same-origin URL of StreamSaver's `mitm.html`; without it the StreamSaver tier is skipped. */
  readonly streamSaverMitmUrl: string | null;
  /**
   * The last tier keeps the whole file in memory until it is complete. Callers
   * that promise not to buffer (a stream of unknown size) turn it off.
   */
  readonly allowBuffered: boolean;
}

export type FileSinkOpening =
  | {
      readonly kind: 'opened';
      readonly strategy: FileSinkStrategy;
      readonly writable: WritableStream<Uint8Array>;
    }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'unavailable' };
