import { useFunction } from '@frozik/components/hooks/useFunction';
import { Trash2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import { ConfirmDialog } from '../../../../shared/ui/ConfirmDialog';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { sitePlannerT } from '../translations';
import { ToolbarIconButton } from './ToolbarIconButton';

/**
 * The toolbar's «Очистить участок»: sweeps every placed object in one undo
 * step behind a danger-toned confirm. It stands beside export/import — the
 * whole-plan fates together — as its own button, not a menu item: a menu hid
 * it well enough that its owner could not find it.
 */
export const ClearSiteButton = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const [isAsked, setIsAsked] = useState(false);

  const handleAsk = useFunction(() => setIsAsked(true));
  const handleCancel = useFunction(() => setIsAsked(false));
  const handleConfirm = useFunction(() => {
    setIsAsked(false);
    store.document.clearSite();
  });

  return (
    <>
      <ToolbarIconButton
        icon={Trash2}
        label={sitePlannerT.objects.clear}
        isActive={isAsked}
        onActivate={handleAsk}
      />
      <ConfirmDialog
        open={isAsked}
        title={sitePlannerT.objects.clearTitle}
        description={sitePlannerT.objects.clearDescription}
        confirmLabel={sitePlannerT.objects.clearConfirm}
        cancelLabel={sitePlannerT.objects.clearCancel}
        tone="danger"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
});
