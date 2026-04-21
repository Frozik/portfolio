import { Users } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { RoomStore } from '../../application/RoomStore';
import { retroEnTranslations as t } from '../translations/en';

interface EmptyRoomHintProps {
  readonly store: RoomStore;
}

export const EmptyRoomHint = observer(({ store }: EmptyRoomHintProps) => {
  if (store.presentUsers.length > 1) {
    return null;
  }
  if (store.currentSnapshot === null) {
    return null;
  }
  return (
    <div className="flex items-center gap-3 rounded-md border border-dashed border-border bg-surface-elevated px-4 py-3 text-sm text-text-muted">
      <Users size={16} />
      <span>{t.room.offlineBanner}</span>
    </div>
  );
});
