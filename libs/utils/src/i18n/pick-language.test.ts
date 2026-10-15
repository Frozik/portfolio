import { pickLanguage } from './pick-language';

describe('the language picked from the user preferences', () => {
  it.each([
    [['ru-RU'], 'ru'],
    [['en-GB'], 'en'],
    [['nl-NL'], 'en'],
    [[], 'en'],
    [['nl-NL', 'ru-RU', 'en-US'], 'ru'],
    [['RU'], 'ru'],
  ] as const)('is the first supported one of %j: %s', (tags, language) => {
    expect(pickLanguage(tags)).toBe(language);
  });
});
