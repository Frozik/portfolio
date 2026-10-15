import { setStringAsync } from 'expo-clipboard';

import { NATIVE_CLIPBOARD } from './native-clipboard';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

describe('the phone’s clipboard', () => {
  it('answers a refused write with false, not an error', async () => {
    jest.mocked(setStringAsync).mockRejectedValueOnce(new Error('no clipboard service'));

    expect(await NATIVE_CLIPBOARD.write('secret')).toBe(false);
  });

  it('empties the clipboard at a lock', () => {
    jest.mocked(setStringAsync).mockResolvedValueOnce(true);

    NATIVE_CLIPBOARD.clearNow();

    expect(setStringAsync).toHaveBeenLastCalledWith('');
  });

  it('calls a waiting copy back at once, unless it was cancelled', async () => {
    const waiting = jest.fn();
    const cancelled = jest.fn();

    NATIVE_CLIPBOARD.onceWritable(waiting);
    NATIVE_CLIPBOARD.onceWritable(cancelled)();
    await Promise.resolve();

    expect([waiting.mock.calls.length, cancelled.mock.calls.length]).toEqual([1, 0]);
  });
});
