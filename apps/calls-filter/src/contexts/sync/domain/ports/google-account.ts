/** How connecting to the user's Google account ended. */
type TConnectOutcome =
  | { readonly kind: 'connected'; readonly account: string | null }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'failed'; readonly reason: string };

/** The Google account on the phone the book is kept with; no password ever reaches the app. */
export interface IGoogleAccount {
  /** The system's account picker and consent screen. */
  connect(): Promise<TConnectOutcome>;
  disconnect(account: string | null): Promise<void>;
}
