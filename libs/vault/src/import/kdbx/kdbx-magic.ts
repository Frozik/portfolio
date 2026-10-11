/** KeePass 2 files open with two little-endian signatures: `0x9AA2D903`, then `0xB54BFB67`. */
const KDBX_MAGIC = [0x03, 0xd9, 0xa2, 0x9a, 0x67, 0xfb, 0x4b, 0xb5] as const;

export function startsWithKdbxMagic(bytes: Uint8Array): boolean {
  return KDBX_MAGIC.every((byte, index) => bytes[index] === byte);
}
