import { serveRpc } from '@frozik/utils/worker/rpc-server';

import type { Language } from '@frozik/utils/i18n/language';
import { estimateStrength } from '@frozik/vault-app/audit/application/strength-estimate';
import type { IPasswordStrength } from '@frozik/vault-app/keys/domain/master-password';

export type TStrengthContract = {
  readonly estimate: {
    readonly request: {
      readonly password: string;
      readonly userInputs: readonly string[];
      readonly language: Language;
    };
    readonly response: IPasswordStrength;
  };
};

serveRpc<TStrengthContract>(self, {
  estimate: {
    handle: ({ password, userInputs, language }) =>
      estimateStrength(password, userInputs, language),
  },
});
