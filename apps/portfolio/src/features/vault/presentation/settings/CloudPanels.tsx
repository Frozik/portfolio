import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import { ChevronLeft } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import { Button } from '../../../../shared/ui/Button';
import type { TChosenCloud, TCloudStep } from '../../application/cloud-wizard';
import type { CloudSetup } from '../../application/CloudSetup';
import { WizardSteps } from '../components/WizardSteps';
import { cloudT } from '../translations/cloud';
import type { TCloudPanelAction } from './FoundVaults';
import { DriveVaults, GoogleDriveConnectPanel } from './GoogleDriveConnectPanel';
import { WebDavConnectPanel, WebDavVaults } from './WebDavConnectPanel';

const ICON_SIZE = 16;
const STEP_INDEX: Readonly<Record<TCloudStep['kind'], number>> = { choose: 0, connect: 1, pick: 2 };

const ConnectStep = observer(({ cloud }: { readonly cloud: TChosenCloud }) =>
  cloud.kind === 'drive' ? (
    <GoogleDriveConnectPanel form={cloud.form} />
  ) : (
    <WebDavConnectPanel form={cloud.form} />
  )
);

const PickStep = observer(
  ({
    cloud,
    driveAction,
    webDavAction,
  }: {
    readonly cloud: TChosenCloud;
    readonly driveAction: TCloudPanelAction;
    readonly webDavAction: TCloudPanelAction;
  }) =>
    cloud.kind === 'drive' ? (
      <DriveVaults form={cloud.form} action={driveAction} />
    ) : (
      <WebDavVaults form={cloud.form} action={webDavAction} />
    )
);

const ChooseStep = observer(({ cloud }: { readonly cloud: CloudSetup }) => (
  <div className="flex flex-wrap gap-2">
    <Button type="button" variant="secondary" onClick={cloud.openDriveForm}>
      {cloudT.drive.connect}
    </Button>
    <Button type="button" variant="secondary" onClick={cloud.openWebDavForm}>
      {cloudT.webdav.connect}
    </Button>
  </div>
));

/**
 * Google Drive or WebDAV, step by step: choose the cloud, connect to it,
 * then keep the vault in the folder or open one found there. Only the
 * current step shows; the next one opens once its condition is met, and
 * "Back" returns one step, keeping what was typed.
 */
export const CloudPanels = observer(
  ({
    cloud,
    driveAction,
    webDavAction,
    onClose,
  }: {
    readonly cloud: CloudSetup;
    readonly driveAction: TCloudPanelAction;
    readonly webDavAction: TCloudPanelAction;
    /** Leaves the whole flow, from any step. */
    readonly onClose?: () => void;
  }) => {
    const t = cloudT.wizard;
    const { step } = cloud;
    const lastStep = driveAction.kind === 'keep' ? t.steps.keep : t.steps.open;

    const content = (() => {
      switch (step.kind) {
        case 'choose':
          return <ChooseStep cloud={cloud} />;
        case 'connect':
          return <ConnectStep cloud={step.cloud} />;
        case 'pick':
          return (
            <PickStep cloud={step.cloud} driveAction={driveAction} webDavAction={webDavAction} />
          );
        default:
          return assertNever(step);
      }
    })();

    return (
      <div className="flex flex-col gap-4">
        <WizardSteps
          steps={[t.steps.choose, t.steps.connect, lastStep]}
          current={STEP_INDEX[step.kind]}
        />
        {content}
        {(step.kind !== 'choose' || !isNil(onClose)) && (
          <div className="flex flex-wrap gap-2">
            {step.kind !== 'choose' && (
              <Button
                type="button"
                variant="secondary"
                disabled={cloud.opening.kind === 'opening'}
                onClick={cloud.back}
              >
                <ChevronLeft size={ICON_SIZE} aria-hidden />
                {t.back}
              </Button>
            )}
            {!isNil(onClose) && (
              <Button type="button" variant="ghost" onClick={onClose}>
                {cloudT.webdav.cancel}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }
);
