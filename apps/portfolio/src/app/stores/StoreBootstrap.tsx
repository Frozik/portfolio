import { configure } from 'mobx';
import type { ReactNode } from 'react';
import { memo } from 'react';

import { RootStore } from './RootStore';
import { StoreProvider } from './StoreContext';

configure({ enforceActions: 'always' });

const rootStore = new RootStore();

const StoreBootstrapComponent = ({ children }: { readonly children: ReactNode }) => (
  <StoreProvider value={rootStore}>{children}</StoreProvider>
);

export const StoreBootstrap = memo(StoreBootstrapComponent);
