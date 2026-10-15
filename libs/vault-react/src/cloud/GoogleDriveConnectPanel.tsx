import type { TDriveSpace } from '@frozik/cloud-storage/google-drive/drive-space';
import { TextEditor } from '@frozik/components/components/RichEditor/TextEditor';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { observer } from 'mobx-react-lite';

import { Alert } from '@frozik/components/ui/Alert';
import { Button } from '@frozik/components/ui/Button';
import { RadioGroup } from '@frozik/components/ui/RadioGroup';
import type { GoogleDriveConnectForm } from '@frozik/vault-app/cloud/application/GoogleDriveConnectForm';
import { driveConnectFailureText } from '@frozik/vault-app/texts/cloud/cloud-wording';
import { VaultField } from '../form/VaultField';
import { cloudT } from '../texts/cloud';
import type { TCloudPanelAction } from './FoundVaults';
import { FoundVaults } from './FoundVaults';

const CheckProgress = observer(({ form }: { readonly form: GoogleDriveConnectForm }) => {
  const t = cloudT.drive;
  const { check } = form;
  switch (check.kind) {
    case 'unchecked':
    case 'found':
      return null;
    case 'signing-in':
      return <p className="text-[13px] text-landing-fg-dim">{t.signingIn}</p>;
    case 'looking':
      return <p className="text-[13px] text-landing-fg-dim">{t.looking}</p>;
    case 'failed':
      return <Alert type="error" message={driveConnectFailureText(cloudT, check.failure)} />;
    default:
      return assertNever(check);
  }
});

/** The vaults the sign-in found in the Drive folder, and what to do there. */
export const DriveVaults = observer(
  ({
    form,
    action,
  }: {
    readonly form: GoogleDriveConnectForm;
    readonly action: TCloudPanelAction;
  }) => {
    const t = cloudT.drive;
    const { check } = form;
    if (check.kind !== 'found') {
      return null;
    }
    return (
      <div className="flex flex-col gap-3">
        <Alert
          type="success"
          message={check.vaults.length === 0 ? t.noVaults : t.vaultsFound(check.vaults.length)}
        />
        <FoundVaults vaults={check.vaults} action={action} />
      </div>
    );
  }
);

/**
 * Where in Drive (a visible
 * folder or the app's hidden one, each with its own permission), then the
 * Google sign-in popup straight from the click.
 */
export const GoogleDriveConnectPanel = observer(
  ({ form }: { readonly form: GoogleDriveConnectForm }) => {
    const t = cloudT.drive;
    const options: readonly { readonly label: string; readonly value: TDriveSpace }[] = [
      { value: 'my-drive', label: t.spaces['my-drive'].label },
      { value: 'app-data', label: t.spaces['app-data'].label },
    ];

    return (
      <div className="flex flex-col gap-4" data-testid="drive-connect">
        <h4 className="text-[15px] font-medium text-landing-fg">{t.title}</h4>
        <RadioGroup options={options} value={form.space} onChange={form.setSpace} />
        <p className="text-[13px] text-landing-fg-dim">{t.spaces[form.space].description}</p>
        {form.space === 'my-drive' && (
          <VaultField
            label={t.folder}
            hint={t.folderHint}
            error={form.folderProblem ? t.folderProblem : null}
          >
            {describedBy => (
              <TextEditor
                aria-label={t.folder}
                aria-describedby={describedBy}
                aria-invalid={form.folderProblem}
                value={form.folder}
                onValueChange={form.setFolder}
              />
            )}
          </VaultField>
        )}
        <Button
          type="button"
          className="self-start"
          disabled={!form.ready || form.folderProblem || form.check.kind === 'signing-in'}
          data-testid="drive-sign-in"
          onClick={() => void form.connect()}
        >
          {form.ready ? t.signIn : t.loading}
        </Button>
        <CheckProgress form={form} />
      </div>
    );
  }
);
