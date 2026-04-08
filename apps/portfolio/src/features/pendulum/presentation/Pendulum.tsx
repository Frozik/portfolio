import { useFunction } from '@frozik/components';
import { isSyncedValueDescriptor, isWaitingArgumentsValueDescriptor } from '@frozik/utils';
import type { DockviewApi, DockviewReadyEvent } from 'dockview';
import { DockviewReact } from 'dockview';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useUnmount } from 'usehooks-ts';
import { OverlayLoader } from '../../../shared/components/OverlayLoader';
import { cn } from '../../../shared/lib/cn';
import { usePendulumStore } from '../application/usePendulumStore';
import { usePreventScreensaver } from './hooks/usePreventScreensaver';
import { DEFAULT_LAYOUT, LAYOUT_COMPONENTS, LAYOUT_TAB_COMPONENTS } from './layout';
import styles from './Pendulum.module.scss';

export const Pendulum = observer(() => {
  usePreventScreensaver();

  const store = usePendulumStore();
  const { robotId } = useParams<{ robotId: string }>();

  // init is idempotent — safe to call on every mount (including StrictMode double-mount).
  // dispose is NOT tied to useEffect cleanup because StrictMode would destroy
  // the singleton store's subscriptions and re-init would create conflicting IndexedDB connections.
  useEffect(() => {
    store.init();
  }, [store]);

  useEffect(() => {
    store.loadRobot(robotId);
  }, [store, robotId]);

  const { registerApi, resetApi } = store.tabManager;

  const layout = store.layout;

  const [api, setApi] = useState<DockviewApi>();

  useEffect(() => {
    if (isNil(api)) {
      return;
    }

    api.fromJSON(isSyncedValueDescriptor(layout) ? layout.value : DEFAULT_LAYOUT);
  }, [api, layout]);

  useEffect(() => {
    if (isNil(api)) {
      return;
    }

    const disposable = api.onDidLayoutChange(() => store.updateLayout(api.toJSON()));

    return () => disposable.dispose();
  }, [api, store]);

  const handleLayoutReady = useFunction((event: DockviewReadyEvent) => {
    setApi(event.api);
    registerApi(event.api);
  });

  useUnmount(() => resetApi());

  return isWaitingArgumentsValueDescriptor(layout) ? (
    <OverlayLoader />
  ) : (
    <DockviewReact
      className={cn(styles.container, 'dockview-theme-abyss')}
      components={LAYOUT_COMPONENTS}
      tabComponents={LAYOUT_TAB_COMPONENTS}
      onReady={handleLayoutReady}
    />
  );
});
