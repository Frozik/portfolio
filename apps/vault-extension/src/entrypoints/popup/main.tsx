import { isNil } from 'lodash-es';
import { configure } from 'mobx';
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
const root = document.getElementById('root');
if (!isNil(root)) {
  createRoot(root).render(<PopupApp model={model} />);
  void model.start();
}
