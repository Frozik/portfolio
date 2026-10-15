export interface IFileToSave {
  readonly name: string;
  readonly mime: string;
  readonly bytes: Uint8Array<ArrayBuffer>;
}

type TFileSaved = 'saved' | 'cancelled' | 'unavailable';

/** The save dialog opens at the call, so it must come straight from the click. */
export type TSaveFile = (file: IFileToSave) => Promise<TFileSaved>;
