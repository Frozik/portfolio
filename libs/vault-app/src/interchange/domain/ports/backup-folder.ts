/** A vault file in the backup folder. */
export interface IBackupFileEntry {
  readonly name: string;
  readonly modifiedAt: number;
  readonly size: number;
}

/** A folder on this device that keeps copies of the vault file, outside the app's own stores. */
export interface IBackupFolder {
  /** Where it is, as a file manager shows it. */
  readonly location: string;
  /** Newest first; `null` when the folder cannot be read. */
  list(): Promise<readonly IBackupFileEntry[] | null>;
  read(name: string): Promise<Uint8Array<ArrayBuffer> | null>;
  /** `false` when the file could not be written (a full disk). */
  write(name: string, bytes: Uint8Array<ArrayBuffer>): Promise<boolean>;
  remove(name: string): Promise<boolean>;
}
