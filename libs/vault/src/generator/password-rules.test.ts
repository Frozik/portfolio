import passwordRules from '../data/apple-password-manager-resources/password-rules.json';
import { aCardWith, aField } from '../testing/builders';
import { createSeededRandom } from '../testing/seeded-random';
import { meetsPasswordRules, parsePasswordRules } from './password-rules';
import { generateForRules } from './rule-password';
import { passwordRulesForHost, passwordRulesOfCard } from './site-password-rules';

const URL_SPEC = { kind: 'url', match: 'host', useSharedCredentials: true } as const;

describe('site password rules', () => {
  it('reads lengths, consecutive runs, required sets one each and what else is allowed', () => {
    const rules = parsePasswordRules(
      'minlength: 8; maxlength: 15; max-consecutive: 3; required: digit; required: upper,lower; allowed: [-_];'
    );

    expect(rules).toMatchObject({ minLength: 8, maxLength: 15, maxConsecutive: 3 });
    expect(rules.required.map(set => set.length)).toEqual([10, 52]);
    expect(rules.allowed).toEqual(['-', '_']);
  });

  it('reads a custom class holding brackets and separators, with "]]" for a closing bracket', () => {
    const rules = parsePasswordRules('required: [;:[]]; minlength: 9');

    expect(rules.required).toEqual([[';', ':', '[', ']']]);
    expect(rules.minLength).toBe(9);
  });

  it('skips unknown rules, bad numbers and characters outside printable ASCII', () => {
    const rules = parsePasswordRules('passwordrules-v2: x; minlength: many; required: [£a];');

    expect(rules).toEqual({
      minLength: null,
      maxLength: null,
      maxConsecutive: null,
      required: [['a']],
      allowed: [],
    });
  });

  it('generates a password every site of the list accepts', () => {
    const random = createSeededRandom(3);
    const rejected = Object.entries(passwordRules).filter(([, entry]) => {
      const rules = parsePasswordRules(entry['password-rules']);
      const generated = generateForRules(random, rules, 20);
      return !generated.ok || !meetsPasswordRules(generated.value.value, rules);
    });

    expect(rejected).toEqual([]);
  });

  it('keeps the preferred length inside the site’s range', () => {
    const rules = parsePasswordRules('minlength: 6; maxlength: 12;');
    const generated = generateForRules(createSeededRandom(1), rules, 20);

    expect(generated.ok && generated.value.value.length).toBe(12);
  });

  it('says so when the rules leave no password', () => {
    expect(
      generateForRules(createSeededRandom(1), parsePasswordRules('minlength: 9; maxlength: 4;'), 20)
    ).toEqual({
      ok: false,
      error: 'site-rules',
    });
    expect(
      generateForRules(
        createSeededRandom(1),
        parsePasswordRules('allowed: [a]; max-consecutive: 1; minlength: 4'),
        4
      )
    ).toEqual({ ok: false, error: 'site-rules' });
  });

  it('finds a site by its host or the nearest domain above it, and a card by its address', () => {
    expect(passwordRulesForHost('id.account.samsung.com')?.domain).toBe('account.samsung.com');
    expect(passwordRulesForHost('example.org')).toBeNull();

    const card = aCardWith([
      aField(URL_SPEC, ['https://example.org', 'https://account.samsung.com/login']),
    ]);
    expect(passwordRulesOfCard(card)?.domain).toBe('account.samsung.com');
  });
});
