/**
 * CXF defines no file of its own, so the archive is ours:
 * the header as `cxf.json`, each file under `documents/<its CXF id>`.
 */
export const CXF_PATH = 'cxf.json';
export const CXF_DOCUMENTS = 'documents/';

/**
 * An encrypted copy whose files are too big for its container:
 * a zip of the copy and its blob files as they are sealed (their keys live only
 * inside the copy).
 */
export const COPY_VAULT_PATH = 'vault.pwv';

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const;

export function startsWithZipMagic(bytes: Uint8Array): boolean {
  return ZIP_MAGIC.every((byte, index) => bytes[index] === byte);
}
