import { useFunction } from '@frozik/components/hooks/useFunction';
import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';

import { sharedT } from '../translations';
import { Alert } from '../ui/Alert';
import { useAuthSession, useOidcProviders } from './CommunicationProvider';
import type { IOidcProvider } from './oidc/IOidcProvider';
import { SIGN_IN_BUTTONS } from './oidc/sign-in-buttons';
import type { IOidcSignInResult } from './oidc/types';

interface ISignInGateProps {
  readonly children: ReactNode;
}

/**
 * Gates access to a feature behind an OIDC sign-in. Renders one button
 * per configured provider — the gate iterates `useOidcProviders()` and
 * picks the matching component out of `SIGN_IN_BUTTONS`. No
 * provider-specific branching lives here; adding a third provider is
 * purely a registry edit.
 */
export const SignInGate = observer(({ children }: ISignInGateProps) => {
  const session = useAuthSession();
  const providers = useOidcProviders();

  const handleResult = useFunction((provider: IOidcProvider, result: IOidcSignInResult) => {
    session.adoptResult(provider.id, result);
  });

  if (session.isSignedIn) {
    return <>{children}</>;
  }

  const hasAnyProvider = providers.size > 0;
  const orderedProviders = Array.from(providers.values());

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-lg text-text">{sharedT.signInGate.title}</h2>
      <p className="max-w-md text-center text-sm text-text-muted">
        {sharedT.signInGate.description}
      </p>
      {!hasAnyProvider && <Alert type="warning" message={sharedT.signInGate.missingClientId} />}
      <div className="flex flex-col items-stretch gap-3">
        {orderedProviders.map(provider => {
          const Button = SIGN_IN_BUTTONS[provider.id];
          return (
            <Button
              key={provider.id}
              provider={provider}
              onResult={result => handleResult(provider, result)}
            />
          );
        })}
      </div>
    </div>
  );
});
