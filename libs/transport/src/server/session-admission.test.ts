import { createSessionAdmission } from './session-admission';

const MINUTE_MS = 60 * 1000;

function admission(clock = { now: 0 }) {
  return {
    gate: createSessionAdmission({
      allowedOrigins: ['https://site.example'],
      maxSessionsPerIp: 2,
      attemptsPerIpPerMinute: 3,
      behindProxy: ['websocket'],
      now: () => clock.now,
    }),
    clock,
  };
}

const PAGE = { ip: '1.2.3.4', origin: 'https://site.example' } as const;

describe('session admission', () => {
  it('turns away pages from other origins but not clients that send none', () => {
    const { gate } = admission();
    expect(gate.admit({ ...PAGE, origin: 'https://evil.example' }, 'http3')).toBe(false);
    expect(gate.admit({ ...PAGE, origin: undefined }, 'http3')).toBe(true);
  });

  it('caps live sessions per address and frees the slot when one closes', () => {
    const { gate } = admission();
    gate.opened(PAGE.ip, 'http3');
    gate.opened(PAGE.ip, 'http3');
    expect(gate.admit(PAGE, 'http3')).toBe(false);
    gate.closed(PAGE.ip, 'http3');
    expect(gate.admit(PAGE, 'http3')).toBe(true);
  });

  it('caps attempts per address per minute', () => {
    const { gate, clock } = admission();
    expect([1, 2, 3, 4].map(() => gate.admit(PAGE, 'http3'))).toEqual([true, true, true, false]);
    clock.now = MINUTE_MS;
    expect(gate.admit(PAGE, 'http3')).toBe(true);
  });

  it('applies no per-address limit where the address is the proxy and hides it from handlers', () => {
    const { gate } = admission();
    for (let session = 0; session < 5; session += 1) {
      gate.opened('127.0.0.1', 'websocket');
    }
    expect(gate.admit({ ip: '127.0.0.1', origin: undefined }, 'websocket')).toBe(true);
    expect(gate.clientAddress('127.0.0.1', 'websocket')).toBeUndefined();
    expect(gate.clientAddress(PAGE.ip, 'http3')).toBe(PAGE.ip);
  });
});
