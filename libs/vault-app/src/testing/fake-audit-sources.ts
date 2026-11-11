import type { IVaultSessionServices } from '../session/application/vault-session-inputs';

/** The fake strength meter calls a password this short weak. */
const WEAK_LENGTH = 10;

/**
 * The audit's outside world on a test device: a meter that judges by length and writes down every
 * password it is asked about, the breaches the test names, and a 2FA list of one site.
 */
export function fakeAuditSources({
  breached,
  strengthAsked,
}: {
  readonly breached: ReadonlySet<string>;
  readonly strengthAsked: string[];
}): IVaultSessionServices['auditSources'] {
  return {
    meter: () => ({
      id: 'fake',
      estimate: password => {
        strengthAsked.push(password);
        return Promise.resolve({
          score: password.length < WEAK_LENGTH ? 1 : 4,
          offlineCrackTime: '',
          warning: null,
          suggestions: [],
        });
      },
      dispose: () => undefined,
    }),
    breaches: { count: password => Promise.resolve(breached.has(password) ? 1 : 0) },
    loadTwoFactorDirectory: () => Promise.resolve(new Set(['github.com'])),
  };
}
