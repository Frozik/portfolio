import { describe, expect, it } from 'vitest';

import { TAUNT_LINE_COUNT } from '../../domain/constants';
import { scorchedTranslationsEn } from './en';
import { scorchedTranslationsRu } from './ru';

/**
 * The store picks a taunt by index, never by text, so both languages must carry exactly the number
 * of lines the domain constant promises — a short list would render an empty bubble.
 */
describe('taunt lines', () => {
  it.each([
    ['en', scorchedTranslationsEn],
    ['ru', scorchedTranslationsRu],
  ])('%s carries the promised number of lines of each kind', (_language, translations) => {
    expect(translations.taunts.attack).toHaveLength(TAUNT_LINE_COUNT);
    expect(translations.taunts.death).toHaveLength(TAUNT_LINE_COUNT);
  });

  it.each([
    ['en', scorchedTranslationsEn],
    ['ru', scorchedTranslationsRu],
  ])('%s has no blank or duplicated lines', (_language, translations) => {
    const lines = [...translations.taunts.attack, ...translations.taunts.death];

    expect(lines.every(line => line.trim().length > 0)).toBe(true);
    expect(new Set(lines).size).toBe(lines.length);
  });
});
