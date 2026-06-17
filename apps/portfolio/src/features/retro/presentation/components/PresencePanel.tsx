import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { Crown } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { initialsOf } from '../../../../shared/lib/initialsOf';
import { Tooltip } from '../../../../shared/ui/Tooltip';
import type { RoomStore } from '../../application/RoomStore';
import type { ClientId, IParticipant } from '../../domain/types';
import { retroT as t } from '../translations';

const MAX_VISIBLE_AVATARS = 3;

/**
 * Single neutral background for initials-only avatars (Yandex users
 * with no avatar set, or peers whose `pictureUrl` hasn't been
 * received via awareness yet). Per-user colors are gone — identity
 * is derived entirely from OIDC.
 */
const FALLBACK_AVATAR_BG = 'var(--color-landing-accent)';

/**
 * Compact presence strip for the Room top bar. Shows up to three stacked
 * user avatars (first slot reserved for the facilitator, marked with a
 * crown), with overflow collapsed into a `+N members` chip. A pulsing
 * status dot announces each participant is live. When the facilitator
 * is offline, any other participant can take over via the inline button.
 */
export const PresencePanel = observer(({ store }: { readonly store: RoomStore }) => {
  const users = store.presentUsers;
  const myClientId = store.identity.clientId as ClientId;
  const facilitatorId = store.currentSnapshot?.meta.facilitatorClientId ?? null;
  const isFacilitatorOnline =
    facilitatorId !== null && users.some(user => user.clientId === facilitatorId);

  const handleTakeOver = useFunction(() => store.claimFacilitator());

  if (store.currentSnapshot === null) {
    return null;
  }

  // Order: facilitator first (if online), then everyone else. This keeps
  // the crowned avatar anchored to the leftmost slot even when that user
  // joined later than the rest.
  const orderedUsers = [...users].sort((left, right) => {
    if (facilitatorId === null) {
      return 0;
    }
    if (left.clientId === facilitatorId) {
      return -1;
    }
    if (right.clientId === facilitatorId) {
      return 1;
    }
    return 0;
  });

  const visibleUsers = orderedUsers.slice(0, MAX_VISIBLE_AVATARS);
  const overflowCount = Math.max(0, users.length - visibleUsers.length);
  const needsTakeOver = !store.isFacilitator && !isFacilitatorOnline;

  return (
    <div className="flex items-center gap-3">
      {needsTakeOver && (
        <button
          type="button"
          onClick={handleTakeOver}
          title={t.room.takeOverHint}
          className="border border-landing-yellow/40 bg-landing-yellow/10 px-2.5 py-1 font-mono text-[10px] tracking-[0.08em] text-landing-yellow uppercase transition-colors hover:bg-landing-yellow/20"
        >
          {t.room.takeOver}
        </button>
      )}

      <div className="flex items-center">
        {visibleUsers.map((user, index) => (
          <Avatar
            key={user.clientId}
            user={user}
            isFacilitator={user.clientId === facilitatorId}
            isMe={user.clientId === myClientId}
            stackOffset={index > 0}
          />
        ))}
        {overflowCount > 0 && (
          <span className="-ml-2 inline-flex h-[26px] items-center justify-center rounded-full border-2 border-landing-bg bg-landing-bg-elev px-2 font-mono text-[10px] text-landing-fg-dim">
            {t.room.membersOverflow.replace('{count}', String(overflowCount))}
          </span>
        )}
      </div>
    </div>
  );
});

const Avatar = ({
  user,
  isFacilitator,
  isMe,
  stackOffset,
}: {
  readonly user: IParticipant;
  readonly isFacilitator: boolean;
  readonly isMe: boolean;
  readonly stackOffset: boolean;
}) => {
  const tooltipParts = [user.name, isFacilitator ? t.room.facilitatorBadge : null].filter(
    (part): part is string => part !== null
  );

  const avatarClassName = cn(
    'relative inline-flex h-[26px] w-[26px] items-center justify-center overflow-hidden rounded-full border-2 border-landing-bg text-[10px] font-semibold text-landing-bg shadow-sm transition-transform hover:z-10 hover:scale-110',
    stackOffset && '-ml-2',
    isMe && 'ring-1 ring-landing-accent/60'
  );

  return (
    <Tooltip title={tooltipParts.join(' · ')} placement="bottom">
      <div
        className={avatarClassName}
        style={isNil(user.pictureUrl) ? { backgroundColor: FALLBACK_AVATAR_BG } : undefined}
      >
        {isNil(user.pictureUrl) ? (
          initialsOf(user.name)
        ) : (
          <img src={user.pictureUrl} alt={user.name} className="h-full w-full object-cover" />
        )}
        <span
          aria-hidden="true"
          className="absolute right-0 bottom-0 h-1.5 w-1.5 animate-status-pulse rounded-full border border-landing-bg bg-landing-green"
        />
        {isFacilitator && (
          <Crown
            size={10}
            strokeWidth={1.6}
            aria-label={t.room.facilitatorBadge}
            className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-landing-yellow"
          />
        )}
      </div>
    </Tooltip>
  );
};
