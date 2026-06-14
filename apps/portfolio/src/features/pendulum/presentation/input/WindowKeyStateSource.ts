import type { IKeyStateSource } from '../../domain/players/IKeyStateSource';

/**
 * DOM-backed {@link IKeyStateSource}: tracks pressed key codes via `window`
 * keyboard listeners. Lives in presentation (keyboard input is a UI concern),
 * so the pendulum domain stays free of browser globals. Inject into
 * {@link HumanPlayer}; call {@link dispose} to detach the listeners.
 */
export class WindowKeyStateSource implements IKeyStateSource {
  private readonly pressedKeys = new Set<string>();

  constructor() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  public isPressed(code: string): boolean {
    return this.pressedKeys.has(code);
  }

  public dispose(): void {
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
