import { useFunction } from '@frozik/components/hooks/useFunction';
import type { CredentialResponse } from '@react-oauth/google';
import { GoogleLogin } from '@react-oauth/google';
import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';

import { sharedT } from '../translations';
import { Alert } from '../ui/Alert';
import { useAuthSession, useGoogleClientId } from './CommunicationProvider';

interface ISignInGateProps {
  readonly children: ReactNode;
}

/**
 * Gates access to a feature behind a Google sign-in. The retro and
 * conf entry points wrap their content with this so the new
 * `apps/communication` server (which requires a verified ID token)
 * can authenticate the WebSocket handshake.
 *
 * The component:
 *  - shows the standard Google sign-in button when no session,
 *  - surfaces a dev-time hint if the OAuth client id env var is
 *    missing, since `<GoogleLogin>` would otherwise fail with a
 *    bare console error,
 *  - lets the wrapped tree render once `setIdToken` populates the
 *    session.
 */
export const SignInGate = observer(({ children }: ISignInGateProps) => {
  const session = useAuthSession();
  const clientId = useGoogleClientId();
  const isClientIdMissing = clientId.trim().length === 0;

  const handleSuccess = useFunction((response: CredentialResponse) => {
    if (typeof response.credential !== 'string' || response.credential.length === 0) {
      return;
    }
    session.setIdToken(response.credential);
  });

  const handleError = useFunction(() => {
    // The Google identity SDK already logs errors to the console;
    // we keep the gate idle so the user can retry by clicking the
    // button again.
  });

  if (session.isSignedIn) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-lg text-text">{sharedT.signInGate.title}</h2>
      <p className="max-w-md text-center text-sm text-text-muted">
        {sharedT.signInGate.description}
      </p>
      {isClientIdMissing ? (
        <Alert type="warning" message={sharedT.signInGate.missingClientId} />
      ) : (
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={handleError}
          useOneTap={false}
          // `filled_black` matches the dark portfolio theme — the
          // default `outline` button shows up as a stark white card on
          // our near-black background. Button label is auto-localised
          // by Google Identity Services from `navigator.language`, so
          // no `locale` prop is needed.
          theme="filled_black"
          shape="pill"
        />
      )}
    </div>
  );
});
