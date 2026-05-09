// Minimal ambient typings for the subset of `window.google.accounts.id`
// used by the silent ID-token refresh helper. The full reference lives at
// https://developers.google.com/identity/gsi/web/reference/js-reference.
//
// Pulling `@types/google.accounts` is overkill for our narrow surface and
// adds a dependency we'd otherwise not need. The library itself ships from
// https://accounts.google.com/gsi/client (loaded by `<GoogleOAuthProvider>`).

interface IGoogleIdInitConfig {
  readonly client_id: string;
  readonly callback: (response: { credential?: string }) => void;
  readonly auto_select?: boolean;
  readonly cancel_on_tap_outside?: boolean;
  readonly use_fedcm_for_prompt?: boolean;
  readonly login_hint?: string;
  readonly nonce?: string;
}

interface IGooglePromptNotification {
  isDisplayMoment(): boolean;
  isDisplayed(): boolean;
  isNotDisplayed(): boolean;
  isSkippedMoment(): boolean;
  isDismissedMoment(): boolean;
  getNotDisplayedReason():
    | 'browser_not_supported'
    | 'invalid_client'
    | 'missing_client_id'
    | 'opt_out_or_no_session'
    | 'secure_http_required'
    | 'suppressed_by_user'
    | 'unregistered_origin'
    | 'unknown_reason';
  getSkippedReason(): 'auto_cancel' | 'user_cancel' | 'tap_outside' | 'issuing_failed';
  getDismissedReason(): 'credential_returned' | 'cancel_called' | 'flow_restarted';
  getMomentType(): 'display' | 'skipped' | 'dismissed';
}

interface IGoogleAccountsId {
  initialize(config: IGoogleIdInitConfig): void;
  prompt(callback?: (notification: IGooglePromptNotification) => void): void;
  cancel(): void;
  disableAutoSelect(): void;
}

interface Window {
  readonly google?: {
    readonly accounts?: {
      readonly id?: IGoogleAccountsId;
    };
  };
}
