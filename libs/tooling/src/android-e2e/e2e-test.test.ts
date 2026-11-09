import { waitFor } from './device.ts';
import { within } from './e2e-test.ts';

describe('the waits of an e2e test', () => {
  it('returns what was waited for the moment it is there', async () => {
    let reads = 0;
    const seen = await waitFor(
      'the third read',
      async () => ++reads,
      value => value === 3,
      10_000
    );
    expect(seen).toBe(3);
  });

  it('gives up on an event that never comes, saying what it last saw', async () => {
    await expect(
      waitFor(
        'a call',
        async () => 'ringing',
        value => value === 'answered',
        0
      )
    ).rejects.toThrow('last seen: "ringing"');
  });

  it('fails work that runs past its limit instead of waiting for it', async () => {
    const never = new Promise<void>(() => {});
    await expect(within(never, 10, 'a hung flow')).rejects.toThrow('«a hung flow» still ran');
  });
});
