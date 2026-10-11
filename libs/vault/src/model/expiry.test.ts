import { Temporal } from 'temporal-polyfill';

import { aCardWith, aField, anHlc } from '../testing/builders';
import { expiresOn, expiryAfter, expiryStatus, warningDaysFor } from './expiry';
import type { TTemplateId } from './ids';
import { emptyVaultDocument } from './vault-document';

const today = Temporal.PlainDate.from('2026-10-11');

describe('expiry', () => {
  it('counts a card month to its last day, leap years included', () => {
    expect(expiresOn(aCardWith([aField({ kind: 'expiry-month' }, '2028-02')]))?.toString()).toBe(
      '2028-02-29'
    );
    expect(expiresOn(aCardWith([aField({ kind: 'expiry-month' }, '2027-02')]))?.toString()).toBe(
      '2027-02-28'
    );
  });

  it('takes the earliest expiry across all fields and ignores what is not a date', () => {
    const card = aCardWith([
      aField({ kind: 'expiry-date' }, '2031-05-17'),
      aField({ kind: 'expiry-month' }, '2027-12'),
      aField({ kind: 'expiry-date' }, 'not a date'),
      aField({ kind: 'date' }, '2020-01-01'),
    ]);

    expect(expiresOn(card)?.toString()).toBe('2027-12-31');
    expect(expiresOn(aCardWith([]))).toBeNull();
  });

  it.each([
    ['2026-10-10', 'expired'],
    ['2026-10-11', 'soon'],
    ['2026-11-10', 'soon'],
    ['2026-11-11', 'ok'],
  ])('is %s → %s with a 30-day warning', (date, status) => {
    expect(expiryStatus(aCardWith([aField({ kind: 'expiry-date' }, date)]), today, 30)).toBe(
      status
    );
    expect(expiryStatus(aCardWith([]), today, 30)).toBe('none');
  });

  it('warns about documents half a year ahead unless the vault says otherwise', () => {
    const passport = aCardWith([], { templateId: 'document' as TTemplateId });
    const settings = emptyVaultDocument('Vault', anHlc(1)).settings;

    expect(warningDaysFor(passport, settings)).toBe(180);
    expect(
      warningDaysFor(passport, {
        ...settings,
        expiryWarningDays: { ['document' as TTemplateId]: 90 },
      })
    ).toBe(90);
    expect(warningDaysFor(aCardWith([]), settings)).toBe(30);
  });

  it('offers quick terms that land on a real day', () => {
    const lastOfJanuary = Temporal.PlainDate.from('2028-01-31');

    expect(expiryAfter(lastOfJanuary, 'month-1').toString()).toBe('2028-02-29');
    expect(expiryAfter(today, 'year-10').toString()).toBe('2036-10-11');
  });
});
