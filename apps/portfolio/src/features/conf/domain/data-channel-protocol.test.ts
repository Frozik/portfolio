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
    expect(parseConfDataChannelMessage({ kind: 'typing', value: true })).toBeUndefined();
    expect(parseConfDataChannelMessage({ kind: '', value: 'happy' })).toBeUndefined();
  });

  it('rejects unknown emotion values', () => {
    expect(parseConfDataChannelMessage({ kind: 'emotion', value: 'ecstatic' })).toBeUndefined();
    expect(parseConfDataChannelMessage({ kind: 'emotion', value: 42 })).toBeUndefined();
    expect(parseConfDataChannelMessage({ kind: 'emotion' })).toBeUndefined();
  });

  it('rejects non-record payloads', () => {
    expect(parseConfDataChannelMessage(undefined)).toBeUndefined();
    expect(parseConfDataChannelMessage(undefined)).toBeUndefined();
    expect(parseConfDataChannelMessage('happy')).toBeUndefined();
    expect(parseConfDataChannelMessage(['emotion', 'happy'])).toBeUndefined();
  });
});
