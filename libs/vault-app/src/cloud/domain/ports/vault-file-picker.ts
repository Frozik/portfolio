/** A `.pwv` as the user handed it over: its bytes and the name it had. */
export interface IVaultFile {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly name: string;
}

/** The platform's file chooser for a `.pwv`; `null` when the user closed it without one. */
export type TPickVaultFile = () => Promise<IVaultFile | null>;
