/** Where "the page went out of sight" comes from — the store never reads the document itself. */
export interface IVisibilitySource {
  /** Calls back each time the page becomes hidden; returns the unsubscribe. */
  onHidden(listener: VoidFunction): VoidFunction;
}
