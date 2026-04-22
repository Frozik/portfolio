import { useFunction } from '@frozik/components';
import { AlertTriangle } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { Button } from '../../../../shared/ui';
import type { RoomStore } from '../../application/RoomStore';
import { retroT as t } from '../translations';

interface FacilitatorMenuProps {
  readonly store: RoomStore;
}

export const FacilitatorMenu = observer(({ store }: FacilitatorMenuProps) => {
  const facilitatorId = store.currentSnapshot?.meta.facilitatorClientId ?? null;
  const isFacilitatorOnline =
    facilitatorId !== null && store.presentUsers.some(user => user.clientId === facilitatorId);

  const handleTakeOver = useFunction(() => store.claimFacilitator());

  if (store.isFacilitator || isFacilitatorOnline) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
      <AlertTriangle size={14} className="text-amber-400" />
      <span className="flex-1 text-sm text-amber-200">{t.room.facilitatorOffline}</span>
      <Button variant="secondary" size="sm" onClick={handleTakeOver}>
        {t.room.takeOver}
      </Button>
    </div>
  );
});
