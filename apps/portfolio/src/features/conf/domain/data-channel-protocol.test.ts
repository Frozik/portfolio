import { describe, expect, it } from 'vitest';
import { parseConfDataChannelMessage } from './data-channel-protocol';

describe('parseConfDataChannelMessage', () => {
  it('parses a valid emotion message for each known emotion', () => {
    const emotions = ['happy', 'surprised', 'sad', 'angry', 'neutral'] as const;
    for (const emotion of emotions) {
      expect(parseConfDataChannelMessage({ kind: 'emotion', value: emotion })).toEqual({
        kind: 'emotion',
        value: emotion,
      });
    }
  });

  it('rejects unknown kinds', () => {
    expect(parseConfDataChannelMessage({ kind: 'typing', value: true })).toBeNull();
    expect(parseConfDataChannelMessage({ kind: '', value: 'happy' })).toBeNull();
  });

  it('rejects unknown emotion values', () => {
    expect(parseConfDataChannelMessage({ kind: 'emotion', value: 'ecstatic' })).toBeNull();
    expect(parseConfDataChannelMessage({ kind: 'emotion', value: 42 })).toBeNull();
    expect(parseConfDataChannelMessage({ kind: 'emotion' })).toBeNull();
  });

  it('rejects non-record payloads', () => {
    expect(parseConfDataChannelMessage(null)).toBeNull();
    expect(parseConfDataChannelMessage(undefined)).toBeNull();
    expect(parseConfDataChannelMessage('happy')).toBeNull();
    expect(parseConfDataChannelMessage(['emotion', 'happy'])).toBeNull();
  });
});
