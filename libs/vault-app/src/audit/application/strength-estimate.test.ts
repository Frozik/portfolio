import { createInThreadStrengthMeter, estimateStrength } from './strength-estimate';

describe('the password strength estimate', () => {
  it('calls a common password weak and a long passphrase strong', async () => {
    const weak = await estimateStrength('password123', [], 'en');
    const strong = await estimateStrength('tundra-velvet-orbit-cactus-lantern', [], 'en');

    expect(weak.score).toBeLessThan(2);
    expect(weak.warning).not.toBeNull();
    expect(strong.score).toBe(4);
  });

  it('marks down a password built from the vault name', async () => {
    const plain = await estimateStrength('HomeVault2026!', [], 'en');
    const named = await estimateStrength('HomeVault2026!', ['HomeVault'], 'en');

    expect(named.score).toBeLessThanOrEqual(plain.score);
  });

  it('answers in the page language and never echoes the password', async () => {
    const verdict = await estimateStrength('qwerty', [], 'ru');

    expect(JSON.stringify(verdict)).not.toContain('qwerty');
    expect(verdict.offlineCrackTime).toMatch(/[а-я]/);
  });
});

describe('the in-thread strength meter', () => {
  it('gives nothing for an estimate cancelled while it ran', async () => {
    const controller = new AbortController();
    const meter = createInThreadStrengthMeter('en');

    const estimate = meter.estimate('password123', [], controller.signal);
    controller.abort();

    expect(await estimate).toBeNull();
  });

  it('lets the screen and the writes go on before each estimate, so a run of them never holds the thread', async () => {
    const meter = createInThreadStrengthMeter('en');
    await meter.estimate('warm up the dictionaries', [], new AbortController().signal);
    const order: string[] = [];

    setTimeout(() => order.push('the next turn of the event loop'), 0);
    await meter.estimate('password123', [], new AbortController().signal);
    order.push('the estimate');

    expect(order).toEqual(['the next turn of the event loop', 'the estimate']);
  });
});
