import type { Brand } from '@frozik/utils/types/base';

/** A caller name or a name mask literal after the one normalization both runtimes apply. */
export type TNormalizedName = Brand<string, 'NormalizedName'>;

const COMBINING_RANGES: readonly (readonly [number, number])[] = [
  [0x0300, 0x036f],
  [0x1ab0, 0x1aff],
  [0x1dc0, 0x1dff],
  [0x20d0, 0x20ff],
  [0xfe20, 0xfe2f],
];
const COMBINING_BREVE = 0x0306;
const CYRILLIC_I = 'и';
const WHITESPACE = /\s+/g;

function isCombiningMark(codePoint: number): boolean {
  return COMBINING_RANGES.some(([from, to]) => codePoint >= from && codePoint <= to);
}

/**
 * Case, accents and spacing never decide a match: «Доставка», «ДОСТАВКА» and «доставка»
 * are one name, «é» is «e» and «ё» is «е». The breve of «й» stays: it is a letter of its
 * own in Russian, not an accent. The Kotlin side repeats this step for step, and the
 * shared fixtures keep the two equal.
 */
export function normalizeName(text: string): TNormalizedName {
  const decomposed = text.normalize('NFKC').toLowerCase().normalize('NFD');
  let kept = '';
  for (const character of decomposed) {
    const codePoint = character.codePointAt(0) ?? 0;
    const keepsBreve = codePoint === COMBINING_BREVE && kept.endsWith(CYRILLIC_I);
    if (!isCombiningMark(codePoint) || keepsBreve) {
      kept += character;
    }
  }
  return kept.normalize('NFC').replace(WHITESPACE, ' ').trim() as TNormalizedName;
}
