export enum ESeparator {
  Colon = ':',
  Dash = '-',
  Slash = '/',
  Dot = '.',
  Comma = ',',
}

export interface ILexeme {
  readonly text: string;
  /** The separator written between this lexeme and the one before it. */
  readonly joint?: ESeparator;
}

const SEPARATORS: ReadonlyMap<string, ESeparator> = new Map([
  [':', ESeparator.Colon],
  ['-', ESeparator.Dash],
  ['/', ESeparator.Slash],
  ['.', ESeparator.Dot],
  [',', ESeparator.Comma],
]);

export function separatorOf(text: string): ESeparator | undefined {
  return SEPARATORS.get(text);
}
