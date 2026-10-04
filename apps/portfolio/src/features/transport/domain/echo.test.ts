import { bytesPerSecond, verifyEcho } from './echo';

const TALLY = {
  declaredBytes: 100,
  sentBytes: 100,
  sentCrc32: 7,
  receivedBytes: 100,
  receivedCrc32: 7,
} as const;
const SUMMARY = { bytes: 100, crc32: 7, maxBufferedBytes: 10 } as const;

describe('echo verification', () => {
  it('calls the echo intact when sizes and checksums agree on every side', () => {
    expect(verifyEcho(TALLY, SUMMARY)).toBe('intact');
  });

  it('reports lost bytes before a changed checksum', () => {
    expect(verifyEcho({ ...TALLY, receivedBytes: 99, receivedCrc32: 1 }, SUMMARY)).toBe(
      'size-mismatch'
    );
    expect(verifyEcho(TALLY, { ...SUMMARY, bytes: 101 })).toBe('size-mismatch');
  });

  it('catches bytes that changed on the way', () => {
    expect(verifyEcho({ ...TALLY, receivedCrc32: 8 }, SUMMARY)).toBe('checksum-mismatch');
    expect(verifyEcho(TALLY, { ...SUMMARY, crc32: 9 })).toBe('checksum-mismatch');
  });

  it('measures speed per second and stays at zero before time has passed', () => {
    expect(bytesPerSecond(5000, 2000)).toBe(2500);
    expect(bytesPerSecond(5000, 0)).toBe(0);
  });
});
