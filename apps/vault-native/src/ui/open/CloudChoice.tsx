import { WEBDAV_PRESETS } from '@frozik/cloud-storage/webdav/webdav-presets';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';

import type { TCloudChoice } from '@frozik/vault-app/cloud/application/cloud-wizard';
import type { CloudSetup } from '@frozik/vault-app/cloud/application/CloudSetup';

import { Select } from '../kit/Select';
import { useCloudTexts } from '../texts';

const DRIVE = 'drive:';
const WEBDAV = 'webdav:';
const CUSTOM_WEBDAV = 'webdav-custom';

function encode(choice: TCloudChoice): string {
  switch (choice.kind) {
    case 'drive':
      return `${DRIVE}${choice.space}`;
    case 'webdav':
      return isNil(choice.presetId) ? CUSTOM_WEBDAV : `${WEBDAV}${choice.presetId}`;
    default:
      return assertNever(choice);
  }
}

function decode(value: string): TCloudChoice {
  if (value === `${DRIVE}app-data`) {
    return { kind: 'drive', space: 'app-data' };
  }
  if (value === `${DRIVE}my-drive`) {
    return { kind: 'drive', space: 'my-drive' };
  }
  return { kind: 'webdav', presetId: value === CUSTOM_WEBDAV ? null : value.slice(WEBDAV.length) };
}

/** Every storage in one list — Drive's two places, the known WebDAV services, a server of one's own. */
export const CloudChoice = observer(function CloudChoice({
  cloud,
}: {
  readonly cloud: CloudSetup;
}) {
  const t = useCloudTexts().chooser;
  const { choice } = cloud;
  return (
    <Select
      testID="cloud-choice"
      label={t.label}
      placeholder={t.placeholder}
      value={isNil(choice) ? null : encode(choice)}
      options={[
        { value: encode({ kind: 'drive', space: 'app-data' }), label: t.driveAppData },
        { value: encode({ kind: 'drive', space: 'my-drive' }), label: t.driveFolder },
        ...WEBDAV_PRESETS.map(preset => ({
          value: encode({ kind: 'webdav', presetId: preset.id }),
          label: t.webdavService(preset.name),
        })),
        { value: CUSTOM_WEBDAV, label: t.webdavCustom },
      ]}
      onChange={value => cloud.choose(decode(value))}
    />
  );
});
