import type { IPickedFile } from '@frozik/components/components/file-drop/FileDrop';
import { makeAutoObservable } from 'mobx';
import type { Temporal } from 'temporal-polyfill';

/** The tabs of the form demo, in the order they show. */
export const FORM_TABS = ['account', 'bank', 'notes'] as const;
export type TFormTab = (typeof FORM_TABS)[number];

export const CURRENCIES = ['eur', 'gbp', 'chf', 'usd', 'jpy'] as const;
export type TCurrency = (typeof CURRENCIES)[number];

/** The region heading each currency is listed under, and its sign, for the grouped select. */
export const CURRENCY_DETAILS: Readonly<
  Record<TCurrency, { readonly region: 'europe' | 'americas' | 'asia'; readonly sign: string }>
> = {
  eur: { region: 'europe', sign: '€' },
  gbp: { region: 'europe', sign: '£' },
  chf: { region: 'europe', sign: 'Fr' },
  usd: { region: 'americas', sign: '$' },
  jpy: { region: 'asia', sign: '¥' },
};

export const GROUPS = ['finance', 'family', 'work', 'travel'] as const;
export type TGroup = (typeof GROUPS)[number];

/** Banks offered as suggestions; any other name may still be typed. */
export const BANK_SUGGESTIONS: readonly string[] = [
  'Deutsche Bank',
  'Commerzbank',
  'BNP Paribas',
  'ING',
  'Santander',
  'HSBC',
  'Barclays',
  'Chase',
  'Bank of America',
  'Wells Fargo',
];

/** The form controls' values: one card-like record the second showcase edits. */
export class FormControlsDemo {
  tab: TFormTab = 'account';
  site = 'https://bank.example/login';
  login = 'jane.doe';
  password = '';
  iban = '';
  phone = '';
  expiry: Temporal.PlainYearMonth | undefined = undefined;
  bank = '';
  currency: TCurrency | undefined = 'eur';
  groups: readonly TGroup[] = ['finance'];
  favorite = false;
  notes = '';
  backupCodes: readonly string[] = [''];
  files: readonly IPickedFile[] = [];

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  setTab(tab: TFormTab): void {
    this.tab = tab;
  }

  setSite(site: string): void {
    this.site = site;
  }

  setLogin(login: string): void {
    this.login = login;
  }

  setPassword(password: string): void {
    this.password = password;
  }

  setIban(iban: string): void {
    this.iban = iban;
  }

  setPhone(phone: string): void {
    this.phone = phone;
  }

  setExpiry(expiry: Temporal.PlainYearMonth | undefined): void {
    this.expiry = expiry;
  }

  setBank(bank: string): void {
    this.bank = bank;
  }

  setCurrency(currency: TCurrency): void {
    this.currency = currency;
  }

  setGroups(groups: readonly TGroup[]): void {
    this.groups = groups;
  }

  setFavorite(favorite: boolean): void {
    this.favorite = favorite;
  }

  setNotes(notes: string): void {
    this.notes = notes;
  }

  setBackupCodes(codes: readonly string[]): void {
    this.backupCodes = codes;
  }

  addFiles(files: readonly IPickedFile[]): void {
    this.files = [...this.files, ...files];
  }
}
