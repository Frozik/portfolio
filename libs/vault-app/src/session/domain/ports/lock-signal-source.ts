/** What the platform tells the session about the user and the app; each subscription returns its unsubscribe. */
export interface ILockSignalSource {
  /** The app is out of sight: a hidden tab, an app in the background. */
  isConcealed(): boolean;
  /** The user did something in the app. */
  onActivity(listener: () => void): () => void;
  onConcealed(listener: (concealed: boolean) => void): () => void;
  /** The app is going away (a page unloading); a lock now must not wait. */
  onUnloading(listener: () => void): () => void;
  /** The app came back from a suspension that kept its memory (the back/forward cache). */
  onResumedFromSuspend(listener: () => void): () => void;
  /** The network came back: a sync waiting for it resumes. */
  onOnline(listener: () => void): () => void;
}
