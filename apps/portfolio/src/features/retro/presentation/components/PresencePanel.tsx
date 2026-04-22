import { useFunction } from '@frozik/components';
import { Crown, Users } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { cn } from '../../../../shared/lib/cn';
import { Button, Tooltip } from '../../../../shared/ui';
import type { RoomStore } from '../../application/RoomStore';
import { useIdentityStore } from '../../application/useIdentityStore';
import type { ClientId } from '../../domain/types';
import { retroT as t } from '../translations';
import { IdentityDialog } from './IdentityDialog';

interface PresencePanelProps {
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

/**
 * Unified presence card replacing the earlier trio of PresenceBar,
 * EmptyRoomHint and FacilitatorMenu. Surfaces in one place:
 *   - who is online (colored avatars with tooltips)
 *   - current status ("waiting for others" / participant count)
 *   - a take-over action when the facilitator has dropped off
 *
 * Highlights: the facilitator avatar wears a crown overlay; the current
 * user's avatar gets a brand ring so they can spot themselves in a list.
 * The whole card picks an accent color (muted / brand / amber) based on
 * room state so the room's "health" is readable at a glance.
 */
export const PresencePanel = observer(({ store }: PresencePanelProps) => {
  const identityStore = useIdentityStore();
  const users = store.presentUsers;
  const myClientId = store.identity.clientId as ClientId;
  const facilitatorId = store.currentSnapshot?.meta.facilitatorClientId ?? null;
  const isFacilitatorOnline =
    facilitatorId !== null && users.some(user => user.clientId === facilitatorId);

  const [isEditIdentityOpen, setIsEditIdentityOpen] = useState(false);
  const handleOpenEditIdentity = useFunction(() => setIsEditIdentityOpen(true));
  const handleCloseEditIdentity = useFunction(() => setIsEditIdentityOpen(false));
  const handleSubmitIdentity = useFunction((params: { name: string; color: string }) => {
    identityStore.setName(params.name);
    identityStore.setColor(params.color);
    setIsEditIdentityOpen(false);
  });
  const handleTakeOver = useFunction(() => store.claimFacilitator());

  if (store.currentSnapshot === null) {
    return null;
  }

  const onlyMe = users.length <= 1;
  const needsTakeOver = !store.isFacilitator && !isFacilitatorOnline;

  const accent = needsTakeOver
    ? 'border-amber-500/40 bg-amber-500/10'
    : onlyMe
      ? 'border-border bg-surface-elevated'
      : 'border-brand-500/30 bg-surface-elevated';

  const statusText = needsTakeOver
    ? t.room.facilitatorOffline
    : onlyMe
      ? t.room.waitingForPeers
      : `${t.room.participantsLabel}: ${users.length}`;

  const statusClass = needsTakeOver ? 'text-amber-200' : onlyMe ? 'text-text-muted' : 'text-text';

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-3 py-2',
        accent
      )}
    >
      <div className={cn('flex min-w-0 items-center gap-2 text-sm', statusClass)}>
        <Users size={16} className="shrink-0" />
        <span className="truncate">{statusText}</span>
      </div>

      {needsTakeOver && (
        <Button variant="secondary" size="sm" onClick={handleTakeOver}>
          {t.room.takeOver}
        </Button>
      )}

      {users.length > 0 && (
        <div className="ml-auto flex items-center -space-x-2">
          {users.map(user => {
            const isFacilitator = user.clientId === facilitatorId;
            const isMe = user.clientId === myClientId;
            const tooltipParts = [
              user.name,
              isFacilitator ? t.room.facilitatorBadge : null,
              isMe ? t.identity.editButton : null,
            ].filter((part): part is string => part !== null);
            const avatarClass = cn(
              'relative flex h-8 w-8 select-none items-center justify-center rounded-full border-2 text-[11px] font-semibold text-white shadow-sm transition-transform hover:z-10 hover:scale-110',
              isMe ? 'border-brand-400 cursor-pointer' : 'border-surface'
            );
            const avatarContent = (
              <>
                {initialsOf(user.name)}
                {isFacilitator && (
                  <Crown
                    size={10}
                    className="absolute -right-1 -top-1 rounded-full bg-amber-400 p-0.5 text-surface shadow-sm"
                  />
                )}
              </>
            );
            return (
              <Tooltip key={user.clientId} title={tooltipParts.join(' · ')} placement="bottom">
                {isMe ? (
                  <button
                    type="button"
                    onClick={handleOpenEditIdentity}
                    aria-label={t.identity.editButton}
                    className={avatarClass}
                    style={{ backgroundColor: user.color }}
                  >
                    {avatarContent}
                  </button>
                ) : (
                  <div className={avatarClass} style={{ backgroundColor: user.color }}>
                    {avatarContent}
                  </div>
                )}
              </Tooltip>
            );
          })}
        </div>
      )}

      <IdentityDialog
        open={isEditIdentityOpen}
        initialName={identityStore.identity.name}
        initialColor={identityStore.identity.color}
        onSubmit={handleSubmitIdentity}
        onClose={handleCloseEditIdentity}
      />
    </div>
  );
});
