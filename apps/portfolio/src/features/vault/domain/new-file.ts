/** What the user picked to attach: a name, the type the browser reported, the bytes. */
export interface INewFile {
  readonly name: string;
  readonly type: string;
  readonly bytes: Uint8Array<ArrayBuffer>;
}

/**
 * Why a file stayed out: over the largest blob, its sealed copy not written
 * on this device, or a session that only reads (a newer version wrote the vault).
 */
export type TAttachRefusal = 'too-large' | 'not-stored' | 'read-only';
