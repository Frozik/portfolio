/** What the tabs of one vault tell each other. */
export type TTabMessage = { readonly kind: 'changed' } | { readonly kind: 'locked' };

/** A channel between the tabs of one vault on this device. */
export interface ITabChannel {
  post(message: TTabMessage): void;
  onMessage(listener: (message: TTabMessage) => void): () => void;
  close(): void;
}
