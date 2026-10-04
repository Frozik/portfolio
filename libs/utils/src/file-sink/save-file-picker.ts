/** The File System Access save dialog, which the TypeScript DOM lib does not describe yet (Chromium only). */
declare global {
  interface SaveFilePickerType {
    readonly description?: string;
    readonly accept: Readonly<Record<string, readonly string[]>>;
  }

  interface SaveFilePickerOptions {
    readonly suggestedName?: string;
    readonly types?: readonly SaveFilePickerType[];
  }

  interface Window {
    showSaveFilePicker?(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
  }
}

// oxlint-disable-next-line unicorn/require-module-specifiers -- a module with nothing of its own: the export only makes the global augmentation above legal
export {};
