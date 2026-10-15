import { assertNever } from '@frozik/utils/assert/assertNever';
import type { TFieldSpec } from '@frozik/vault/model/card';

import { Checkbox } from '../kit/Checkbox';
import { Select } from '../kit/Select';
import { TextField } from '../kit/TextField';

const ISO_MONTH = 'YYYY-MM';
const ISO_DATE = 'YYYY-MM-DD';

/** A value in its kind's control; masks stay off: the value is stored as typed, the validation says what is wrong. */
export function SingleValueEditor({
  spec,
  label,
  value,
  onChange,
  testID,
}: {
  readonly spec: TFieldSpec;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly testID?: string;
}) {
  const text = { label, value, onChangeText: onChange, testID };
  switch (spec.kind) {
    case 'text':
    case 'login':
    case 'bank-code':
    case 'iban':
    case 'bic':
    case 'bank-account':
      return <TextField {...text} />;
    case 'email':
      return <TextField {...text} kind="email" />;
    case 'url':
      return <TextField {...text} kind="url" />;
    case 'phone':
      return <TextField {...text} kind="phone" />;
    case 'card-number':
      return <TextField {...text} kind="number" secret />;
    case 'password':
    case 'secret':
    case 'otp':
    case 'security-question':
      return <TextField {...text} secret />;
    case 'pin':
    case 'cvv':
      return <TextField {...text} kind="number" secret />;
    case 'multiline':
    case 'note':
      return <TextField {...text} multiline />;
    case 'expiry-month':
      return <TextField {...text} label={`${label} (${ISO_MONTH})`} kind="number" />;
    case 'date':
    case 'expiry-date':
      return <TextField {...text} label={`${label} (${ISO_DATE})`} kind="number" />;
    case 'boolean':
      return (
        <Checkbox
          testID={testID}
          label={label}
          checked={value === 'true'}
          onChange={next => onChange(String(next))}
        />
      );
    case 'select':
      return spec.allowCustom ? (
        <TextField {...text} />
      ) : (
        <Select
          testID={testID}
          label={label}
          value={value}
          options={spec.options.map(option => ({ value: option, label: option }))}
          onChange={onChange}
        />
      );
    case 'file':
    case 'unknown':
      return null;
    default:
      return assertNever(spec);
  }
}
