import { Crc32 } from './crc32';

const encoder = new TextEncoder();

function crcOf(...parts: readonly string[]): number {
  const crc = new Crc32();
  for (const part of parts) {
    crc.update(encoder.encode(part));
  }
  return crc.value;
}

describe('CRC-32', () => {
  it('matches the reference check values', () => {
    expect(crcOf('')).toBe(0);
    expect(crcOf('123456789')).toBe(0xcbf43926);
    expect(crcOf('The quick brown fox jumps over the lazy dog')).toBe(0x414fa339);
  });

  it('gives the same value however the input is split into chunks', () => {
    expect(crcOf('1234', '', '56789')).toBe(crcOf('123456789'));
  });
});
