import { isNil } from 'lodash-es';

const NATIVE_VALUE = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

/**
 * A value typed as a person would: focus, the native setter
 * (a React or Vue controlled input ignores a plain assignment), `input` and
 * `change` that bubble, a key press, then blur for validation on leave.
 */
export function typeInto(input: HTMLInputElement, value: string): void {
  input.focus();
  NATIVE_VALUE?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Unidentified' }));
  input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Unidentified' }));
  input.blur();
}

/** A code split into boxes: a character each, an `input` per box (pages move focus on it). */
export function typeSplit(inputs: readonly HTMLInputElement[], code: string): boolean {
  if (inputs.length !== code.length) {
    return false;
  }
  inputs.forEach((input, index) => {
    const character = code.charAt(index);
    if (!isNil(character)) {
      typeInto(input, character);
    }
  });
  return true;
}
