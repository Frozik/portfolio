/** The system clipboard; writing needs the document to have focus. */
export interface IClipboard {
  write(text: string): Promise<boolean>;
  hasFocus(): boolean;
  /** Calls back once, the next time the document gains focus. */
  onceFocused(listener: () => void): () => void;
  /** The lock reloads the page; the next page clears on its first focus. */
  clearAfterReload(): void;
}
