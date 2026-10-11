import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';

import { Button } from '../../../../shared/ui/Button';
import { CardFrame } from '../../../../shared/ui/CardFrame';
import type { VaultFeatureStore } from '../../application/VaultFeatureStore';
import type { VaultSession } from '../../application/VaultSession';
import { cloudT } from '../translations/cloud';
import { CloudPanels } from './CloudPanels';
import { locationText } from './location-text';

/**
 * Where the vault is kept; a vault on
 * this device only offers Google Drive and WebDAV, a linked one its
 * disconnection (the cloud file stays).
 */
export const CloudSection = observer(
  ({ store, session }: { readonly store: VaultFeatureStore; readonly session: VaultSession }) => {
    const t = cloudT.section;
    const { location } = session.cloud;
    return (
      <CardFrame className="flex flex-col gap-4 p-6">
        <h3 className="text-[16px] font-medium text-landing-fg">{t.title}</h3>
        <p className="text-[13px] text-landing-fg-dim">{locationText(location)}</p>
        {isNil(location) ? (
          <CloudPanels
            cloud={store.cloud}
            driveAction={{ kind: 'keep', onKeep: () => void store.cloud.keepInDrive(session) }}
            webDavAction={{ kind: 'keep', onKeep: () => void store.cloud.keepInWebDav(session) }}
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            <Button
              type="button"
              variant="secondary"
              className="self-start"
              onClick={() => void store.cloud.disconnect(session)}
            >
              {t.disconnect}
            </Button>
            <span className="text-[12px] text-landing-fg-faint">{t.disconnectNote}</span>
          </div>
        )}
      </CardFrame>
    );
  }
);
