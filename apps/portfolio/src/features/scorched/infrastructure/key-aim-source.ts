import { MS_PER_SECOND } from '@frozik/utils/date/constants';
import { isNil } from 'lodash-es';

import { isEditableEventTarget } from '../../../shared/lib/isEditableEventTarget';
import type { IScorchedInputSource, ScorchedInput } from '../domain/scorched-input';

type AdjustmentAxis = 'dial' | 'power';

interface KeyAdjustment {
  readonly axis: AdjustmentAxis;
  readonly step: number;
  /** [§12] Shift trims the step for the last degree of aim; the coarse keys ignore it. */
  readonly isFineable: boolean;
}

/** [§12] Arrows move by one unit, Page Up/Down by ten, Shift cuts a step to a tenth. */
const COARSE_POWER_STEP = 10;
const FINE_STEP_FRACTION = 0.1;

const ADJUSTMENT_BY_KEY_CODE: Readonly<Record<string, KeyAdjustment>> = {
  ArrowLeft: { axis: 'dial', step: 1, isFineable: true },
  ArrowRight: { axis: 'dial', step: -1, isFineable: true },
  ArrowUp: { axis: 'power', step: 1, isFineable: true },
  ArrowDown: { axis: 'power', step: -1, isFineable: true },
  PageUp: { axis: 'power', step: COARSE_POWER_STEP, isFineable: false },
  PageDown: { axis: 'power', step: -COARSE_POWER_STEP, isFineable: false },
};

const FIRE_KEY_CODE = 'Space';
const WEAPON_CYCLE_KEY_CODE = 'Tab';

/** Held keys repeat like a text cursor: one step on press, then a burst after a short delay. */
const INITIAL_REPEAT_DELAY_SECONDS = 0.3;
const REPEAT_INTERVAL_SECONDS = 0.04;
const FIRST_STEP = 1;

interface HeldKeyState {
  readonly pressedAtSeconds: number;
  emittedSteps: number;
}

function countDueSteps(heldSeconds: number): number {
  if (heldSeconds < INITIAL_REPEAT_DELAY_SECONDS) {
    return FIRST_STEP;
  }

  const repeatSeconds = heldSeconds - INITIAL_REPEAT_DELAY_SECONDS;

  return FIRST_STEP + 1 + Math.floor(repeatSeconds / REPEAT_INTERVAL_SECONDS);
}

/**
 * Keyboard aiming (§12): arrows turn the barrel and trim the power, Page Up/Down jump it in
 * tens, Shift makes any arrow step fine, Tab cycles the weapon and Space fires.
 *
 * Aiming has no simulation ticks to hang repeats off — the turn stands still until the player
 * shoots — so the source keeps its own clock and the draw orchestrator polls it once a frame.
 */
export class KeyAimSource implements IScorchedInputSource {
  private readonly heldKeys = new Map<string, HeldKeyState>();
  private readonly nowSeconds: () => number;
  private isFineModifierHeld = false;
  private isFireQueued = false;
  private isWeaponCycleQueued = false;

  constructor(nowSeconds: () => number = () => performance.now() / MS_PER_SECOND) {
    this.nowSeconds = nowSeconds;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
  }

  read(): ScorchedInput {
    const now = this.nowSeconds();
    let dialDelta = 0;
    let powerDelta = 0;

    for (const [keyCode, state] of this.heldKeys) {
      const adjustment = ADJUSTMENT_BY_KEY_CODE[keyCode];
      const dueSteps = countDueSteps(now - state.pressedAtSeconds);
      const pendingSteps = dueSteps - state.emittedSteps;

      state.emittedSteps = dueSteps;

      if (pendingSteps <= 0) {
        continue;
      }

      const scale = this.isFineModifierHeld && adjustment.isFineable ? FINE_STEP_FRACTION : 1;
      const amount = pendingSteps * adjustment.step * scale;

      if (adjustment.axis === 'dial') {
        dialDelta += amount;
      } else {
        powerDelta += amount;
      }
    }

    const input: ScorchedInput = {
      dialDelta,
      powerDelta,
      aimOverride: undefined,
      isFireRequested: this.isFireQueued,
      isWeaponCycleRequested: this.isWeaponCycleQueued,
    };

    this.isFireQueued = false;
    this.isWeaponCycleQueued = false;

    return input;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    this.heldKeys.clear();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (isEditableEventTarget(event.target)) {
      return;
    }

    const { code } = event;
    const adjustment = ADJUSTMENT_BY_KEY_CODE[code];

    this.isFineModifierHeld = event.shiftKey;

    if (!isNil(adjustment)) {
      // Arrows and Page keys scroll the page; the battlefield owns them while it is on screen.
      event.preventDefault();

      if (!this.heldKeys.has(code)) {
        this.heldKeys.set(code, { pressedAtSeconds: this.nowSeconds(), emittedSteps: 0 });
      }

      return;
    }

    if (code !== FIRE_KEY_CODE && code !== WEAPON_CYCLE_KEY_CODE) {
      return;
    }

    event.preventDefault();

    // Both are single acts: the operating system's own key repeat must not queue a second shot
    // that goes off the moment the turn comes back around.
    if (event.repeat) {
      return;
    }

    if (code === FIRE_KEY_CODE) {
      this.isFireQueued = true;
    } else {
      this.isWeaponCycleQueued = true;
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.isFineModifierHeld = event.shiftKey;
    this.heldKeys.delete(event.code);
  };

  private readonly handleBlur = (): void => {
    this.heldKeys.clear();
    this.isFineModifierHeld = false;
    this.isFireQueued = false;
    this.isWeaponCycleQueued = false;
  };
}
