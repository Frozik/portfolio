import { isNil } from 'lodash-es';
import { configure } from 'mobx';
import { createRoot } from 'react-dom/client';

import { PopupModel } from '../../application/PopupModel';
import { activeTab, askWorker, requestHost } from '../../infrastructure/worker-messaging';
import { PopupApp } from '../../popup/PopupApp';

configure({ enforceActions: 'always' });

const model = new PopupModel(askWorker, activeTab, requestHost, () => window.close());
const root = document.getElementById('root');
if (!isNil(root)) {
  createRoot(root).render(<PopupApp model={model} />);
  void model.start();
}
