import { serveRpc } from '@frozik/utils/worker/rpc-server';

import type { Language } from '../../../shared/i18n/types';
import type { IPasswordStrength } from '../domain/master-password';
import { estimateStrength } from './strength-estimate';

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
