/** The set of currently held key codes, as seen by {@link HumanPlayer}. */
export interface IKeyStateSource {
  isPressed(code: string): boolean;
  dispose(): void;
}
