import type { IRpcClient } from '@frozik/utils/worker/rpc-client';
import { createRpcClient } from '@frozik/utils/worker/rpc-client';

import type { Language } from '@frozik/utils/i18n/language';
import type { IStrengthMeter } from '@frozik/vault-app/audit/domain/ports/strength-meter';
import type { TStrengthContract } from './strength.worker';

/** A separate lazy Worker: zxcvbn and its dictionaries load only on a password screen. */
export function createStrengthMeterClient(language: Language): IStrengthMeter {
  let client: IRpcClient<TStrengthContract> | null = null;
  const connect = (): IRpcClient<TStrengthContract> =>
    createRpcClient<TStrengthContract>(
      new Worker(new URL('./strength.worker.ts', import.meta.url), { type: 'module' })
    );

  return {
    async estimate(password, userInputs, signal) {
      const current = (client ??= connect());
      const result = await current.call('estimate', { password, userInputs, language }, { signal });
      if (result.ok) {
        return result.value;
      }
      if (result.error.kind === 'worker-crashed' && client === current) {
        client = null;
      }
      return null;
    },
    dispose() {
      client?.dispose();
      client = null;
    },
  };
}
