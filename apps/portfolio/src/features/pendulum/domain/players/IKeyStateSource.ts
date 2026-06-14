/**
 * Port abstracting the set of currently-held key codes for {@link HumanPlayer},
 * keeping browser globals (`window` keyboard events) out of the domain. The
 * presentation layer injects a concrete implementation; the player only asks
 * whether a given code is pressed.
 */
export interface IKeyStateSource {
  isPressed(code: string): boolean;
  dispose(): void;
}
