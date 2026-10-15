import { SecretEditor } from '@frozik/components/components/RichEditor/SecretEditor';
import { isNil } from 'lodash-es';
import { useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { Button } from '@frozik/components/ui/Button';
import { LANGUAGE } from '../texts/language';
import { VaultField } from './VaultField';

/** The master password typed for one action: the field empties as soon as the password leaves it. */
export function PasswordAction({
  label,
  submitLabel,
  workingLabel,
  working,
  error,
  onSubmit,
}: {
  readonly label: string;
  readonly submitLabel: string;
  readonly workingLabel: string;
  readonly working: boolean;
  readonly error: string | null;
  readonly onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState('');
  const submit = useEventCallback(() => {
    if (password === '' || working) {
      return;
    }
    onSubmit(password);
    setPassword('');
  });
  return (
    <div className="flex flex-col gap-3">
      <VaultField label={label} error={error}>
        {describedBy => (
          <SecretEditor
            aria-label={label}
            aria-describedby={describedBy}
            aria-invalid={!isNil(error)}
            autoComplete="current-password"
            value={password}
            onValueChange={setPassword}
            onEnter={submit}
            disabled={working}
            locale={LANGUAGE}
          />
        )}
      </VaultField>
      <Button
        type="button"
        className="self-start"
        disabled={password === '' || working}
        onClick={submit}
      >
        {working ? workingLabel : submitLabel}
      </Button>
    </div>
  );
}
