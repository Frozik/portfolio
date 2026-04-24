import { configure } from 'mobx';
import type { ReactNode } from 'react';
import { memo } from 'react';

import { RootStore } from './RootStore';
import { StoreProvider } from './StoreContext';

configure({ enforceActions: 'always' });

const rootStore = new RootStore();

interface IStoreBootstrapProps {
  readonly children: ReactNode;
}

const StoreBootstrapComponent = ({ children }: IStoreBootstrapProps) => (
  <StoreProvider value={rootStore}>{children}</StoreProvider>
);

export const StoreBootstrap = memo(StoreBootstrapComponent);
