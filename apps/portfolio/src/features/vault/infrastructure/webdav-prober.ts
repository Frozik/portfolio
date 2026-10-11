import { storagePath } from '@frozik/cloud-storage/core/storage-path';
import { probeWebDav } from '@frozik/cloud-storage/webdav/webdav-probe';
import { createWebDavProvider } from '@frozik/cloud-storage/webdav/webdav-provider';
import { createWebDavTransport } from '@frozik/cloud-storage/webdav/webdav-transport';
import { err, ok } from '@frozik/utils/result/result';

import { isVaultFile } from '../domain/cloud-files';
import type { TProbeWebDav } from '../domain/ports/webdav-prober';

const FOLDER = storagePath('');

export const probeWebDavServer: TProbeWebDav = async (account, signal) => {
  const transport = createWebDavTransport(account);
  const probed = await probeWebDav(transport, signal);
  if (!probed.ok) {
    return probed;
  }
  const listed = await createWebDavProvider({ transport, features: probed.value }).list(
    FOLDER,
    signal
  );
  return listed.ok
    ? ok({ features: probed.value, vaults: listed.value.filter(stat => isVaultFile(stat.path)) })
    : err(listed.error);
};
