/**
 * Whether the dotted trajectory ghost is on screen. The gesture handlers in React own the
 * answer and the render layer reads it, so a mutable holder is passed between them rather than an
 * observable — the layer runs per frame and must never subscribe to MobX.
 */
export class AimGhost {
  private isVisibleValue = false;

  get isVisible(): boolean {
    return this.isVisibleValue;
  }

  setVisible(isVisible: boolean): void {
    this.isVisibleValue = isVisible;
  }
}
