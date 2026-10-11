import { Checkbox } from '@frozik/components/components/RichEditor/Checkbox';
import { DateTimePicker } from '@frozik/components/components/RichEditor/DateTimePicker';
import type { IRichEditorHandle } from '@frozik/components/components/RichEditor/defs';
import { MASKS } from '@frozik/components/components/RichEditor/masked-input';
import { MaskedEditor } from '@frozik/components/components/RichEditor/MaskedEditor';
import { MonthYearEditor } from '@frozik/components/components/RichEditor/MonthYearEditor';
import { MultilineEditor } from '@frozik/components/components/RichEditor/MultilineEditor';
import { SecretEditor } from '@frozik/components/components/RichEditor/SecretEditor';
import { TextEditor } from '@frozik/components/components/RichEditor/TextEditor';
import { UrlEditor } from '@frozik/components/components/RichEditor/UrlEditor';
import { Combobox } from '@frozik/components/components/select/Combobox';
import { Select } from '@frozik/components/components/select/Select';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { parseFuzzyDate } from '@frozik/utils/date/fuzzy/parseFuzzyDate';
import type { Ref } from 'react';
import { memo } from 'react';
import { Temporal } from 'temporal-polyfill';

import type { TFieldSpec } from '../../model/card';
import { cardNumberMask } from './editor-masks';

const PIN_FORMAT = { digitsOnly: true, maxLength: 12 } as const;
const CVV_FORMAT = { digitsOnly: true, maxLength: 4 } as const;

function nowInstant(): Temporal.Instant {
  return Temporal.Now.instant();
}

function plainDateOf(value: string): Temporal.ZonedDateTime | undefined {
  try {
    return Temporal.PlainDate.from(value).toZonedDateTime(Temporal.Now.timeZoneId());
  } catch {
    return undefined;
  }
}

function yearMonthOf(value: string): Temporal.PlainYearMonth | undefined {
  try {
    return Temporal.PlainYearMonth.from(value);
  } catch {
    return undefined;
  }
}

/**
 * The library control for one value of a field kind, with
 * the kind's configuration. The vault has no inputs of its own: a new kind is
 * a new branch here over an existing control. Values stay in the stored form
 * (`YYYY-MM`, ISO dates, `'true'`), converted only at the control's edge.
 */
export const SingleValueEditor = memo(
  ({
    ref,
    spec,
    value,
    onValueChange,
    label,
    locale,
    revealTimeoutMs,
  }: {
    readonly ref?: Ref<IRichEditorHandle>;
    readonly spec: TFieldSpec;
    readonly value: string;
    readonly onValueChange: (value: string) => void;
    readonly label: string;
    readonly locale: string;
    /** A shown secret hides itself again after this long. */
    readonly revealTimeoutMs: number;
  }) => {
    const text = { 'aria-label': label, value, onValueChange };
    const secret = { ...text, locale, revealTimeoutMs };
    switch (spec.kind) {
      case 'text':
      case 'login':
        return <TextEditor ref={ref} {...text} />;
      case 'email':
        return <TextEditor ref={ref} {...text} inputMode="email" />;
      case 'url':
        return <UrlEditor ref={ref} {...text} />;
      case 'phone':
        return <MaskedEditor ref={ref} {...text} mask={MASKS.phone} inputMode="numeric" />;
      case 'card-number':
        return (
          <MaskedEditor ref={ref} {...text} mask={cardNumberMask} inputMode="numeric" secret />
        );
      case 'iban':
        return <MaskedEditor ref={ref} {...text} mask={MASKS.iban} />;
      case 'bic':
        return <MaskedEditor ref={ref} {...text} mask={MASKS.bic} />;
      case 'bank-account':
        return <MaskedEditor ref={ref} {...text} mask={MASKS.accountNumber} />;
      case 'bank-code':
        return <TextEditor ref={ref} {...text} />;
      case 'password':
      case 'secret':
      case 'otp':
      case 'security-question':
        return <SecretEditor ref={ref} {...secret} />;
      case 'pin':
        return <SecretEditor ref={ref} {...secret} format={PIN_FORMAT} />;
      case 'cvv':
        return <SecretEditor ref={ref} {...secret} format={CVV_FORMAT} />;
      case 'multiline':
      case 'note':
        return <MultilineEditor ref={ref} {...text} />;
      case 'expiry-month':
        return (
          <MonthYearEditor
            ref={ref}
            aria-label={label}
            value={yearMonthOf(value)}
            onValueChange={next => onValueChange(next?.toString() ?? '')}
            locale={locale}
          />
        );
      case 'date':
      case 'expiry-date':
        return (
          <DateTimePicker
            timeZone={Temporal.Now.timeZoneId()}
            getNow={nowInstant}
            onParseInput={parseFuzzyDate}
            value={plainDateOf(value)}
            onValueChange={next => onValueChange(next?.toPlainDate().toString() ?? '')}
            showTime={false}
            locale={locale}
          />
        );
      case 'boolean':
        return (
          <Checkbox
            checked={value === 'true'}
            onCheckedChange={next => onValueChange(String(next))}
          >
            {label}
          </Checkbox>
        );
      case 'select':
        return spec.allowCustom ? (
          <Combobox ref={ref} {...text} suggestions={spec.options} locale={locale} />
        ) : (
          <Select
            aria-label={label}
            options={spec.options.map(option => ({ value: option, label: option }))}
            value={value === '' ? undefined : value}
            onValueChange={onValueChange}
            locale={locale}
          />
        );
      case 'file':
      case 'unknown':
        return null;
      default:
        return assertNever(spec);
    }
  }
);
