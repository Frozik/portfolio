import { selectPluralForm } from '@frozik/utils/i18n/plural';

const FORMS = { one: 'час', few: 'часа', many: 'часов', other: 'часа' };

describe('plural rules on an engine without them', () => {
  it('picks Russian and English forms once the polyfill is in', () => {
    const native = Intl.PluralRules;
    Reflect.deleteProperty(Intl, 'PluralRules');
    try {
      jest.isolateModules(() => {
        require('./intl-plural-rules');
      });

      expect([
        selectPluralForm('ru', 1, FORMS),
        selectPluralForm('ru', 3, FORMS),
        selectPluralForm('ru', 5, FORMS),
        selectPluralForm('en', 2, { one: 'hour', other: 'hours' }),
      ]).toEqual(['час', 'часа', 'часов', 'hours']);
    } finally {
      Object.defineProperty(Intl, 'PluralRules', {
        value: native,
        configurable: true,
        writable: true,
      });
    }
  });
});
