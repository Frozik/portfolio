import type { ISelection } from './defs';
import {
  createNumericHtmlRenderer,
  createNumericInputNormalizer,
  formatNumericValue,
  parseNumericText,
  roundNumericText,
  settleNumericText,
} from './numeric-input';
import styles from './styles.module.css';

const caretAt = (offset: number): ISelection => ({ start: offset, end: offset });

describe('numeric input normalizer', () => {
  const normalize = createNumericInputNormalizer({});
  const run = (value: string) => normalize(value, caretAt(value.length));

  it('expands a "k" suffix into three trailing zeros and moves the caret past them', () => {
    expect(run('5k')).toEqual({ value: '5000', selection: caretAt(4) });
  });

  it('expands "m" and "b" suffixes', () => {
    expect(run('5m')?.value).toBe('5000000');
    expect(run('5b')?.value).toBe('5000000000');
  });

  it('treats suffixes case-insensitively', () => {
    expect(run('5K')?.value).toBe('5000');
  });

  it('expands a suffix appended to a decimal value', () => {
    expect(run('1.5k')?.value).toBe('1.5000');
  });

  it('passes plain numeric input through unchanged', () => {
    expect(run('123.45')).toEqual({ value: '123.45', selection: caretAt(6) });
  });

  it('rejects more than one suffix character', () => {
    expect(run('5kk')).toBeUndefined();
  });

  it('rejects letters other than the suffixes', () => {
    expect(run('12a')).toBeUndefined();
  });

  it('rejects a second decimal point', () => {
    expect(run('1.2.3')).toBeUndefined();
  });

  it('rejects a minus sign unless negatives are allowed', () => {
    expect(run('-1')).toBeUndefined();
    expect(createNumericInputNormalizer({ allowNegative: true })('-1', caretAt(2))?.value).toBe(
      '-1'
    );
  });

  it('rejects more than 50 digits', () => {
    expect(run(`1${'0'.repeat(50)}`)).toBeUndefined();
  });

  it('rejects more than 15 significant digits', () => {
    expect(run('1234567890123456')).toBeUndefined();
    expect(run('1234567890123450000')?.value).toBe('1234567890123450000');
  });

  it('accepts an empty value', () => {
    expect(run('')).toEqual({ value: '', selection: caretAt(0) });
  });
});

describe('numeric html renderer', () => {
  it('renders nothing for an empty value', () => {
    expect(createNumericHtmlRenderer({})('', false)).toBe('');
    expect(createNumericHtmlRenderer({})('', true)).toBe('');
  });

  it('marks thousands-group boundaries while editing', () => {
    expect(createNumericHtmlRenderer({})('1234', true)).toBe(
      `<span class="${styles.groupEnd}">1</span><span class="${styles.groupStart}">2</span>34`
    );
  });

  it('leaves a single group of digits unmarked', () => {
    expect(createNumericHtmlRenderer({})('123', true)).toBe('123');
  });

  it('pads the fraction to the decimal scale out of focus', () => {
    expect(createNumericHtmlRenderer({ decimal: 2 })('5', false)).toBe('5.00');
    expect(createNumericHtmlRenderer({ decimal: 2 })('5.5', false)).toBe('5.50');
  });

  it('shows the text exactly as typed while editing', () => {
    expect(createNumericHtmlRenderer({ decimal: 2 })('5.', true)).toBe('5.');
    expect(createNumericHtmlRenderer({ decimal: 2 })('.5', true)).toBe('.5');
  });

  it('never trims a longer fraction', () => {
    expect(createNumericHtmlRenderer({ decimal: 0 })('5.5', false)).toBe('5.5');
  });

  it('keeps a leading minus sign', () => {
    expect(createNumericHtmlRenderer({})('-12', true)).toBe('-12');
  });

  it('marks the pip digits', () => {
    expect(createNumericHtmlRenderer({ pipStart: 0, pipSize: 2 })('1', false)).toBe(
      `<span class="${styles.pip}">1</span>.<span class="${styles.pip}">0</span>0`
    );
  });
});

describe('parseNumericText', () => {
  it('reads a finite number', () => {
    expect(parseNumericText('12.5')).toBe(12.5);
  });

  it('has no value for empty or partial text', () => {
    expect(parseNumericText('')).toBeUndefined();
    expect(parseNumericText('-')).toBeUndefined();
  });
});

describe('formatNumericValue', () => {
  it('prints very small and very large numbers without an exponent', () => {
    expect(formatNumericValue(1e-7)).toBe('0.0000001');
    expect(formatNumericValue(1e21)).toBe('1000000000000000000000');
  });

  it('prints nothing for no value', () => {
    expect(formatNumericValue(undefined)).toBe('');
  });
});

describe('roundNumericText', () => {
  it('rounds half up on the decimal digits, not the binary double', () => {
    expect(roundNumericText('1.005', 2)).toBe('1.01');
  });

  it('carries into the integer part', () => {
    expect(roundNumericText('9.999', 2)).toBe('10.00');
    expect(roundNumericText('0.5', 0)).toBe('1');
  });

  it('keeps a negative sign and drops it for a zero result', () => {
    expect(roundNumericText('-1.006', 2)).toBe('-1.01');
    expect(roundNumericText('-0.001', 2)).toBe('0.00');
  });

  it('leaves shorter fractions alone', () => {
    expect(roundNumericText('1.5', 2)).toBe('1.5');
    expect(roundNumericText('15', 2)).toBe('15');
  });
});

describe('settleNumericText', () => {
  it('rounds to the scale when the field loses focus', () => {
    expect(settleNumericText('1.999', { decimals: 2 })).toBe('2.00');
  });

  it('strips trailing fraction zeros when there is no scale', () => {
    expect(settleNumericText('1.500', {})).toBe('1.5');
    expect(settleNumericText('1.000', {})).toBe('1');
    expect(settleNumericText('100', {})).toBe('100');
  });

  it('keeps the value within its bounds', () => {
    expect(settleNumericText('500', { min: 0, max: 100 })).toBe('100');
    expect(settleNumericText('-5', { min: 0 })).toBe('0');
  });

  it('leaves partial text alone', () => {
    expect(settleNumericText('-', { decimals: 2 })).toBe('-');
  });
});
