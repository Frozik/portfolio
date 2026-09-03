import { Sun } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { sitePlannerT } from '../translations';
import { ToolbarIconButton } from './ToolbarIconButton';

/**
 * Shows and hides the sun study bar. The study lights the 3D view and nothing
 * else, so on the plan the button is not there at all — a toolbar of tools that
 * all act says more than one that offers a tool the current view cannot use.
 */
export const SunStudyToggle = observer(({ store }: { readonly store: SitePlannerStore }) => {
  if (store.viewMode !== 'scene') {
    return undefined;
  }

  return (
    <ToolbarIconButton
      icon={Sun}
      label={sitePlannerT.sun.toggle}
      isActive={store.sun.isOpen}
      onActivate={store.sun.toggleOpen}
    />
  );
});
