import type { TUnlockFailure } from '@frozik/vault/lifecycle/lifecycle-state';
import type { TCardId, TFieldId } from '@frozik/vault/model/ids';

import type { ICardSummary, ICardView } from './card-views';
import type { IWebDavSource, TConnectOutcome, TPullOutcome } from './cloud';

/** What the worker is: nothing set up, set up and locked (and why), or open. */
export type TExtensionStatus =
  | { readonly kind: 'not-set-up' }
  | { readonly kind: 'locked'; readonly vaultName: string }
  | { readonly kind: 'unlocked'; readonly vaultName: string };

export type TFillOutcome =
  | 'filled'
  | 'no-form'
  | 'other-site'
  | 'insecure-page'
  | 'not-allowed'
  | 'locked';

/**
 * The popup's requests to the service worker. Only pages
 * of the extension send them; anything from a tab is ignored.
 */
export type TRequest =
  | { readonly kind: 'status' }
  /** Messages travel as JSON: the file's bytes as base64url. */
  | { readonly kind: 'open-file'; readonly file: string; readonly name: string }
  | { readonly kind: 'unlock'; readonly password: string }
  | { readonly kind: 'lock' }
  | {
      readonly kind: 'connect-webdav';
      readonly source: IWebDavSource;
      readonly password: string;
    }
  | { readonly kind: 'sync' }
  | { readonly kind: 'open-protected'; readonly password: string }
  | { readonly kind: 'page-cards'; readonly pageUrl: string }
  | { readonly kind: 'search'; readonly query: string }
  | { readonly kind: 'card'; readonly cardId: TCardId }
  | { readonly kind: 'reveal'; readonly cardId: TCardId; readonly fieldId: TFieldId }
  | { readonly kind: 'copy'; readonly cardId: TCardId; readonly fieldId: TFieldId }
  | { readonly kind: 'copy-code'; readonly cardId: TCardId; readonly fieldId: TFieldId }
  | {
      readonly kind: 'fill';
      readonly cardId: TCardId;
      readonly tabId: number;
      readonly pageUrl: string;
      readonly allowInsecure: boolean;
    };

/** The answer to each request, by its kind. */
interface IResponses {
  readonly status: TExtensionStatus;
  readonly 'open-file': { readonly ok: boolean };
  readonly unlock: TUnlockFailure | null;
  readonly lock: null;
  readonly 'connect-webdav': TConnectOutcome;
  readonly sync: TPullOutcome;
  readonly 'open-protected': TUnlockFailure | null;
  readonly 'page-cards': readonly ICardSummary[];
  readonly search: readonly ICardSummary[];
  readonly card: ICardView | null;
  readonly reveal: string | null;
  readonly copy: boolean;
  readonly 'copy-code': boolean;
  readonly fill: TFillOutcome;
}

export type TResponseOf<Request extends TRequest> = IResponses[Request['kind']];
