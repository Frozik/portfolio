import { requireNativeModule } from 'expo';

interface IVaultFilesModule {
  /** The file Android handed over ("Open with", "Share"), once; `null` when there is none. */
  takeIncomingFile(): Promise<{
    readonly name: string;
    readonly bytes: Uint8Array<ArrayBuffer>;
  } | null>;
  backupLocation(): string;
  listBackups(): Promise<
    readonly { readonly name: string; readonly modifiedAt: number; readonly size: number }[]
  >;
  readBackup(name: string): Promise<Uint8Array<ArrayBuffer> | null>;
  writeBackup(name: string, bytes: Uint8Array<ArrayBuffer>): Promise<boolean>;
  deleteBackup(name: string): Promise<boolean>;
  /** Android handed over another file while the app runs. */
  addListener(event: 'onIncomingFile', listener: () => void): { remove(): void };
}

/** The native module, typed: only the app's adapters import it. */
export const VAULT_FILES = requireNativeModule<IVaultFilesModule>('VaultFiles');
