import type { IRandom } from '@frozik/vault/ports/random';
import { fileHashOf } from '@frozik/vault/session/sync-effect-runner';

import type { IDemoSeed } from '../../session/domain/ports/demo-seed';
import type { ISessionClock } from '../../session/domain/ports/session-clock';
import { withDemoSiteIcons } from '../domain/demo-site-icons';
import { DEMO_SCAN } from '../domain/demo-specimen';
import { DEMO_VAULT_PASSWORD, withDemoCards } from '../domain/demo-vault';

/** The portfolio's demo vault; the scan's hash is computed first, as hashing is asynchronous. */
export function createDemoSeed({
  random,
  clock,
}: {
  readonly random: IRandom;
  readonly clock: ISessionClock;
}): IDemoSeed {
  return {
    password: DEMO_VAULT_PASSWORD,
    async cardsOf(texts) {
      const scan = { ...DEMO_SCAN, sha256: await fileHashOf(DEMO_SCAN.bytes) };
      return (document, at) =>
        withDemoSiteIcons(
          withDemoCards(document, { translate: texts, random, at, today: clock.today(), scan }),
          at
        );
    },
  };
}
