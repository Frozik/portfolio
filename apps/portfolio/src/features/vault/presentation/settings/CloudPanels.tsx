import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';

import { Button } from '../../../../shared/ui/Button';
import type { CloudSetup } from '../../application/CloudSetup';
import { cloudT } from '../translations/cloud';
import type { TCloudPanelAction } from './FoundVaults';
import { GoogleDriveConnectPanel } from './GoogleDriveConnectPanel';
import { WebDavConnectPanel } from './WebDavConnectPanel';

/** Google Drive and WebDAV side by side: a button each, the panel once chosen. */
export const CloudPanels = observer(
  ({
    cloud,
    driveAction,
    webDavAction,
  }: {
    readonly cloud: CloudSetup;
    readonly driveAction: TCloudPanelAction;
    readonly webDavAction: TCloudPanelAction;
  }) => {
    const { driveForm, webDavForm } = cloud;
    return (
      <>
        {isNil(driveForm) ? (
          <Button
            type="button"
            variant="secondary"
            className="self-start"
            onClick={cloud.openDriveForm}
          >
            {cloudT.drive.connect}
          </Button>
        ) : (
          <GoogleDriveConnectPanel
            form={driveForm}
            action={driveAction}
            onClose={cloud.closeDriveForm}
          />
        )}
        {isNil(webDavForm) ? (
          <Button
            type="button"
            variant="secondary"
            className="self-start"
            onClick={cloud.openWebDavForm}
          >
            {cloudT.webdav.connect}
          </Button>
        ) : (
          <WebDavConnectPanel
            form={webDavForm}
            action={webDavAction}
            onClose={cloud.closeWebDavForm}
          />
        )}
      </>
    );
  }
);
