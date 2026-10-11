import type { TDriveSpace } from '@frozik/cloud-storage/google-drive/drive-space';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { observer } from 'mobx-react-lite';

import { Alert } from '../../../../shared/ui/Alert';
import { Button } from '../../../../shared/ui/Button';
import { RadioGroup } from '../../../../shared/ui/RadioGroup';
import type {
  GoogleDriveConnectForm,
  TDriveConnectFailure,
} from '../../application/GoogleDriveConnectForm';
import { cloudT } from '../translations/cloud';
import type { TCloudPanelAction } from './FoundVaults';
import { FoundVaults } from './FoundVaults';

function failureText(failure: TDriveConnectFailure): string {
  if (failure.kind === 'auth') {
    return cloudT.drive.authFailures[failure.reason];
  }
  const { error } = failure;
  return error.kind === 'server'
    ? cloudT.webdav.failures.server(error.status)
    : cloudT.webdav.failures[error.kind];
}

const CheckOutcome = observer(
  ({
    form,
    action,
  }: {
    readonly form: GoogleDriveConnectForm;
    readonly action: TCloudPanelAction;
  }) => {
    const t = cloudT.drive;
    const { check } = form;
    switch (check.kind) {
      case 'unchecked':
        return null;
      case 'signing-in':
        return <p className="text-[13px] text-landing-fg-dim">{t.signingIn}</p>;
      case 'looking':
        return <p className="text-[13px] text-landing-fg-dim">{t.looking}</p>;
      case 'found':
        return (
          <div className="flex flex-col gap-3">
            <Alert
              type="success"
              message={check.vaults.length === 0 ? t.noVaults : t.vaultsFound(check.vaults.length)}
            />
            <FoundVaults vaults={check.vaults} action={action} />
          </div>
        );
      case 'failed':
        return <Alert type="error" message={failureText(check.failure)} />;
      default:
        return assertNever(check);
    }
  }
);

/**
 * Where in Drive (a visible
 * folder or the app's hidden one, each with its own permission), then the
 * Google sign-in popup straight from the click, then "keep this vault here".
 */
export const GoogleDriveConnectPanel = observer(
  ({
    form,
    action,
    onClose,
  }: {
    readonly form: GoogleDriveConnectForm;
    readonly action: TCloudPanelAction;
    readonly onClose: () => void;
  }) => {
    const t = cloudT.drive;
    const options: readonly { readonly label: string; readonly value: TDriveSpace }[] = [
      { value: 'my-drive', label: t.spaces['my-drive'].label },
      { value: 'app-data', label: t.spaces['app-data'].label },
    ];

    return (
      <div className="flex flex-col gap-4">
        <h4 className="text-[15px] font-medium text-landing-fg">{t.title}</h4>
        <RadioGroup options={options} value={form.space} onChange={form.setSpace} />
        <p className="text-[13px] text-landing-fg-dim">{t.spaces[form.space].description}</p>
        <div className="flex gap-2">
          <Button
            type="button"
            disabled={!form.ready || form.check.kind === 'signing-in'}
            onClick={() => void form.connect()}
          >
            {form.ready ? t.signIn : t.loading}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            {cloudT.webdav.cancel}
          </Button>
        </div>
        <CheckOutcome form={form} action={action} />
      </div>
    );
  }
);
