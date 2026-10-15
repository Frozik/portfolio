import { isNil } from 'lodash-es';
import { configure, reaction } from 'mobx';
import { browser } from 'wxt/browser';

import { AppearanceModel } from '@frozik/vault-app/device/application/AppearanceModel';
import { UpdateWatch } from '@frozik/vault-app/release/application/UpdateWatch';
import { createLocalThemeStore } from '@frozik/vault-browser/device/local-theme-store';
import { createVersionJsonSource } from '@frozik/vault-http/release/version-json-source';
import { createRoot } from 'react-dom/client';

import { PopupModel } from '../../application/PopupModel';
import {
  activeTab,
  askWorker,
  closeThisTab,
  isPopupInTab,
  openPopupInTab,
  requestHost,
} from '../../infrastructure/worker-messaging';
import { PopupApp } from '../../popup/PopupApp';

configure({ enforceActions: 'always' });

const inTab = isPopupInTab();
const model = new PopupModel(
  askWorker,
  inTab ? () => Promise.resolve(null) : activeTab,
  requestHost,
  inTab ? closeThisTab : () => window.close(),
  inTab ? null : openPopupInTab
);
/** Published with every release of Ciphra Vault: the extension's channel names its floor. */
const VERSION_MANIFEST_URL = 'https://ciphra-vault.github.io/version.json';
const THEME_KEY = 'vault:theme';

const appearance = new AppearanceModel(createLocalThemeStore(THEME_KEY));
const updates = new UpdateWatch(createVersionJsonSource(VERSION_MANIFEST_URL), {
  client: 'extension',
  version: `v${browser.runtime.getManifest().version}`,
});
// Below the floor an open vault locks: this build may no longer read it.
reaction(
  () => updates.verdict === 'required' && model.status?.kind === 'unlocked',
  mustLock => {
    if (mustLock) {
      void model.lockCompletely();
    }
  }
);

const root = document.getElementById('root');
if (!isNil(root)) {
  createRoot(root).render(<PopupApp model={model} appearance={appearance} updates={updates} />);
  void model.start();
  void updates.check();
}
