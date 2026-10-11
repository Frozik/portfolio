/** What the page tells the session; each subscription returns its unsubscribe. */
export interface IPageSignals {
  isHidden(): boolean;
  /** `pointerdown`, `keydown`, `wheel`. */
  onActivity(listener: () => void): () => void;
  onVisibilityChange(listener: (hidden: boolean) => void): () => void;
  onPageHide(listener: () => void): () => void;
  /** `pageshow` with `persisted`: the page came back from the back/forward cache. */
  onRestoredFromCache(listener: () => void): () => void;
  /** The network came back: a sync waiting for it resumes. */
  onOnline(listener: () => void): () => void;
}
