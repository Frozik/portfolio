import type { TTemplateId } from './ids';
import { conditionsOfRule, ruleOfConditions } from './smart-group-builder';

describe('the smart group builder', () => {
  it('keeps its flat form — all or any of conditions, some negated — and reads it back', () => {
    const conditions = [
      { negated: false, rule: { kind: 'has-field', fieldKind: 'otp' } },
      { negated: true, rule: { kind: 'template', templateIds: ['bank-card' as TTemplateId] } },
    ] as const;

    const rule = ruleOfConditions('any', conditions);

    expect(rule).toEqual({
      kind: 'any',
      rules: [
        { kind: 'has-field', fieldKind: 'otp' },
        { kind: 'not', rule: { kind: 'template', templateIds: ['bank-card'] } },
      ],
    });
    expect(conditionsOfRule(rule)).toEqual({ mode: 'any', conditions });
  });

  it('declines a rule nested deeper than it builds', () => {
    expect(
      conditionsOfRule({ kind: 'all', rules: [{ kind: 'any', rules: [{ kind: 'favorite' }] }] })
    ).toBeNull();
  });
});
