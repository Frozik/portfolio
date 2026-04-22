import { observer } from 'mobx-react-lite';
import { Tooltip } from '../../../../shared/ui';
import type { RoomStore } from '../../application/RoomStore';
import { retroT as t } from '../translations';

interface PresenceBarProps {
  readonly store: RoomStore;
}

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return '?';
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return (parts[0] ?? '?').slice(0, 2).toUpperCase();
  }
  return `${parts[0]?.charAt(0) ?? ''}${parts[1]?.charAt(0) ?? ''}`.toUpperCase();
}

export const PresenceBar = observer(({ store }: PresenceBarProps) => {
  const users = store.presentUsers;
  const facilitatorId = store.currentSnapshot?.meta.facilitatorClientId ?? null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-muted">
        {t.room.participantsLabel}: {users.length}
      </span>
      <div className="flex items-center -space-x-2">
        {users.map(user => {
          const isFacilitator = user.clientId === facilitatorId;
          return (
            <Tooltip
              key={user.clientId}
              title={isFacilitator ? `${user.name} · ${t.room.facilitatorBadge}` : user.name}
              placement="bottom"
            >
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface text-[10px] font-semibold text-white shadow-sm"
                style={{ backgroundColor: user.color }}
              >
                {initialsOf(user.name)}
              </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
});
