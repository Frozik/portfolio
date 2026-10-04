import type { FileSinkOpening } from '@frozik/utils/file-sink/file-sink';

/** Opens the destination on the user's click; writing happens later, as the echo arrives. */
export type FileSinkOpener = (file: {
  readonly name: string;
  /** MIME type as the browser reported it; empty when it could not tell. */
  readonly type: string;
}) => Promise<FileSinkOpening>;
