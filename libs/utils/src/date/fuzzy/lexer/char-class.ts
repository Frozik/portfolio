export enum ECharClass {
  Digit = 'Digit',
  Letter = 'Letter',
  Space = 'Space',
  Colon = 'Colon',
  Dot = 'Dot',
  Comma = 'Comma',
  Dash = 'Dash',
  Slash = 'Slash',
  Plus = 'Plus',
  Apostrophe = 'Apostrophe',
  Other = 'Other',
}

const PUNCTUATION: ReadonlyMap<string, ECharClass> = new Map([
  [' ', ECharClass.Space],
  ['\t', ECharClass.Space],
  ['\n', ECharClass.Space],
  ['\r', ECharClass.Space],
  [',', ECharClass.Comma],
  [':', ECharClass.Colon],
  ['.', ECharClass.Dot],
  ['-', ECharClass.Dash],
  ['/', ECharClass.Slash],
  ['+', ECharClass.Plus],
  ["'", ECharClass.Apostrophe],
]);

export function charClassOf(char: string): ECharClass {
  if (char >= '0' && char <= '9') {
    return ECharClass.Digit;
  }
  if ((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z')) {
    return ECharClass.Letter;
  }
  return PUNCTUATION.get(char) ?? ECharClass.Other;
}
