import type { TIdentityProvider } from '@frozik/communication-protocol/identity';
import { useFunction } from '@frozik/components/hooks/useFunction';
import type { CredentialResponse } from '@react-oauth/google';
import { GoogleLogin } from '@react-oauth/google';
import { observer } from 'mobx-react-lite';
import type { ComponentType, ReactElement } from 'react';
import { memo, useState } from 'react';
import { sharedT } from '../../translations';
import { GoogleOidcProvider } from './GoogleOidcProvider';
import type { IOidcProvider } from './IOidcProvider';
import type { IOidcSignInResult } from './types';

/**
 * Props every provider's sign-in button receives. The button drives
 * the provider-specific UX (popup, GIS widget, ...) and reports the
 * resulting `IOidcSignInResult` back up via `onResult`. It must NOT
 * touch `AuthSession` directly — `<SignInGate>` adopts the result
 * into the session so all providers go through the same code path.
 */
interface ISignInButtonProps {
  readonly provider: IOidcProvider;
  readonly onResult: (result: IOidcSignInResult) => void;
}

const GoogleSignInButton = observer(({ provider, onResult }: ISignInButtonProps) => {
  const handleSuccess = useFunction((response: CredentialResponse) => {
    if (typeof response.credential !== 'string' || response.credential.length === 0) {
      return;
    }
    if (!(provider instanceof GoogleOidcProvider)) {
      return;
    }
    const result = provider.completeSignIn(response.credential);
    if (result === null) {
      return;
    }
    onResult(result);
  });

  const handleError = useFunction(() => {
    // The Google identity SDK already logs errors to the console; we
    // keep the gate idle so the user can retry by clicking the button
    // again.
  });

  return (
    <GoogleLogin
      onSuccess={handleSuccess}
      onError={handleError}
      useOneTap={false}
      // `filled_black` matches the dark portfolio theme — the default
      // `outline` button shows up as a stark white card on our
      // near-black background. Button label is auto-localised by Google
      // Identity Services from `navigator.language`, so no `locale`
      // prop is needed.
      theme="filled_black"
      shape="pill"
    />
  );
});

const YandexSignInButton = observer(({ provider, onResult }: ISignInButtonProps) => {
  const [isPending, setIsPending] = useState(false);
  const handleClick = useFunction(async () => {
    if (isPending) {
      return;
    }
    setIsPending(true);
    try {
      const result = await provider.signIn();
      if (result === null) {
        return;
      }
      onResult(result);
    } finally {
      setIsPending(false);
    }
  });

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={sharedT.signInGate.yandexButton}
      className="inline-flex h-10 min-w-[220px] items-center justify-center gap-2 rounded-full bg-[#FC3F1D] px-5 font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FC3F1D]/60 disabled:opacity-60"
    >
      <YandexLogo />
      <span>{sharedT.signInGate.yandexButton}</span>
    </button>
  );
});

/**
 * Per-provider sign-in button lookup. `<SignInGate>` iterates over the
 * configured providers and renders the matching component without
 * naming any single provider directly. Adding a third provider:
 *  1. Author its `*SignInButton` component in this file.
 *  2. Add the entry to `SIGN_IN_BUTTONS`.
 *
 * `IOidcProvider` itself stays UI-agnostic — keeping React out of the
 * strategy interface means the provider classes are usable from
 * non-React contexts (tests, scripts) without dragging React in.
 */
export const SIGN_IN_BUTTONS: Readonly<
  Record<TIdentityProvider, ComponentType<ISignInButtonProps>>
> = {
  google: GoogleSignInButton,
  yandex: YandexSignInButton,
};

/**
 * Inline rendering of the Yandex "Я" mark. Inline so the gate doesn't
 * need a network round-trip to render its sign-in button — matches the
 * GIS button's instant-paint behaviour.
 */
const YandexLogo = memo(
  (): ReactElement => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M14.5 5h-3.4c-2.4 0-4.1 1.8-4.1 4.4 0 2.3 1.1 3.5 3.1 4.6L7.6 19h2.6l3.1-6.4h-1.1c-1.5 0-2.4-.7-2.4-2.5 0-1.6.9-2.4 2.2-2.4h2.5V19h2.5V5h-2.5z"
        fill="currentColor"
      />
    </svg>
  )
);
