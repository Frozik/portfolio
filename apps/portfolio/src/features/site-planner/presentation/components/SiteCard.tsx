import { useFunction } from '@frozik/components/hooks/useFunction';
import { PencilRuler } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import { Button } from '../../../../shared/ui/Button';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { sitePlannerT } from '../translations';
import { PanelHint } from './PanelHint';
import { PlannerPanel } from './PlannerPanel';

const ICON_SIZE_PX = 14;

/**
 * View mode's door to the ground plan: the plot reads as a finished drawing
 * there, and this card says where its anatomy — shapes, house, terrain marks —
 * is edited. A double-click on the plot itself opens the same editor.
 */
export const SiteCard = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const handleEdit = useFunction(() => store.enterEditMode({ kind: 'site' }));

  return (
    <PlannerPanel title={sitePlannerT.structure.boundary}>
      <Button variant="secondary" size="sm" onClick={handleEdit}>
        <PencilRuler size={ICON_SIZE_PX} aria-hidden />
        {sitePlannerT.modes.editSite}
      </Button>
      <PanelHint>{sitePlannerT.modes.siteCardHint}</PanelHint>
    </PlannerPanel>
  );
});
