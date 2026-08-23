import { isNil } from 'lodash-es';

import { isEditableEventTarget } from '../../../shared/lib/isEditableEventTarget';
import type { Direction, PlayerInputs } from '../domain/types';
import { FireRepeater } from './fire-repeat';

/** Polled exactly once per simulated tick (§12.1). */
export interface IInputSource {
  read(): PlayerInputs;
  dispose(): void;
}

const DIRECTION_BY_KEY_CODE: Readonly<Record<string, Direction>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
};

const FIRE_KEY_CODE = 'Space';

const DIRECTION_KEY_CODES = Object.keys(DIRECTION_BY_KEY_CODE);

/** Held codes are cleared on blur, where the matching `keyup` never arrives. */
export class KeyStateSource implements IInputSource {
  private readonly pressedKeys = new Set<string>();
  private readonly fireRepeater = new FireRepeater();
  private lastDirectionKeyCode: string | undefined;

  constructor() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
  }

  read(): PlayerInputs {
    return {
      direction: this.resolveDirection(),
      fire: this.fireRepeater.read(this.pressedKeys.has(FIRE_KEY_CODE)),
    };
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    this.pressedKeys.clear();
  }

  /** Last key pressed wins, matching the domain's one-direction-per-tick input model. */
  private resolveDirection(): Direction | undefined {
    if (!isNil(this.lastDirectionKeyCode) && this.pressedKeys.has(this.lastDirectionKeyCode)) {
      return DIRECTION_BY_KEY_CODE[this.lastDirectionKeyCode];
    }

    const heldKeyCode = DIRECTION_KEY_CODES.find(keyCode => this.pressedKeys.has(keyCode));

    return isNil(heldKeyCode) ? undefined : DIRECTION_BY_KEY_CODE[heldKeyCode];
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (isEditableEventTarget(event.target)) {
      return;
    }

    const { code } = event;
    const isGameKey = code === FIRE_KEY_CODE || !isNil(DIRECTION_BY_KEY_CODE[code]);

    if (!isGameKey) {
      return;
    }

    // Arrows and Space scroll the page; the game owns them while it is on screen.
    event.preventDefault();

    if (!this.pressedKeys.has(code) && !isNil(DIRECTION_BY_KEY_CODE[code])) {
      this.lastDirectionKeyCode = code;
    }

    this.pressedKeys.add(code);
  };

  private readonly handleKeyUp = ({ code }: KeyboardEvent): void => {
    this.pressedKeys.delete(code);
  };

  private readonly handleBlur = (): void => {
    this.pressedKeys.clear();
    this.lastDirectionKeyCode = undefined;
    this.fireRepeater.reset();
  };
}
