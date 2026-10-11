import { aCardWith, aField } from '../testing/builders';
import { validateField } from './field-validation';

describe('validateField', () => {
  it('judges every value of a list and reports the worst', () => {
    const emails = aField({ kind: 'email' }, ['jane@example.com', 'not an address']);

    expect(validateField(emails, aCardWith([emails]))).toEqual({
      kind: 'warning',
      code: 'email-format',
    });
  });

  it('judges the value in the form "Save" will store, and lets an empty one be', () => {
    const iban = aField({ kind: 'iban' }, 'de89 3704 0044 0532 0130 00');
    const empty = aField({ kind: 'email' }, '');

    expect(validateField(iban, aCardWith([iban])).kind).toBe('valid');
    expect(validateField(empty, aCardWith([empty])).kind).toBe('valid');
  });
});
