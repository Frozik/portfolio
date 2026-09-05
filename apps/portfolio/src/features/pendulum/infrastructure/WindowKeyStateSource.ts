import type { IKeyStateSource } from '../domain/ports/key-state-source';

/** Tracks held key codes through `window` keyboard listeners. */
export class WindowKeyStateSource implements IKeyStateSource {
  private readonly pressedKeys = new Set<string>();

  constructor() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  isPressed(code: string): boolean {
    return this.pressedKeys.has(code);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  private readonly handleKeyDown = ({ code }: KeyboardEvent): void => {
    this.pressedKeys.add(code);
  };

  private readonly handleKeyUp = ({ code }: KeyboardEvent): void => {
    this.pressedKeys.delete(code);
  };
}
