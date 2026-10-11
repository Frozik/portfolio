/** The same physical keys on the Latin (QWERTY) and the Russian (ЙЦУКЕН) layout. */
const LATIN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`";
const CYRILLIC = 'йцукенгшщзхъфывапролджэячсмитьбюё';

const SWAPPED: ReadonlyMap<string, string> = new Map([
  ...[...LATIN].map((key, index): [string, string] => [key, CYRILLIC[index] ?? key]),
  ...[...CYRILLIC].map((key, index): [string, string] => [key, LATIN[index] ?? key]),
]);

/** What the text would have been in the other layout: `ыфиуы` ↔ `sbers`. */
export function inOtherLayout(text: string): string {
  return [...text.toLowerCase()].map(character => SWAPPED.get(character) ?? character).join('');
}
