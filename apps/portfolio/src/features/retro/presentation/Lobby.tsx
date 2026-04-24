import { useFunction } from '@frozik/components/hooks/useFunction';
import { formatISO8601Local } from '@frozik/utils/date/format';
import {
  isFailValueDescriptor,
  isSyncedValueDescriptor,
} from '@frozik/utils/value-descriptors/utils';
import { Crown, Link2, Plus, X } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { memo, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

import { cn } from '../../../shared/lib/cn';
import { Alert } from '../../../shared/ui/Alert';
import { CardFrame } from '../../../shared/ui/CardFrame';
import { MonoKicker } from '../../../shared/ui/MonoKicker';
import { SectionNumber } from '../../../shared/ui/SectionNumber';
import { Spinner } from '../../../shared/ui/Spinner';
import type { ICreateRoomParams } from '../application/RetroLobbyStore';
import { useIdentityStore } from '../application/useIdentityStore';
import { useRetroLobbyStore } from '../application/useRetroLobbyStore';
import { useUserDirectoryStore } from '../application/useUserDirectoryStore';
import type { ClientId, IRoomIndexEntry, RoomId } from '../domain/types';
import { ERetroPhase } from '../domain/types';
import { ConfirmDialog } from './components/ConfirmDialog';
import { CreateRetroDialog } from './components/CreateRetroDialog';
import { IdentityDialog } from './components/IdentityDialog';
import { retroT as t } from './translations';

const ROOM_ID_FROM_URL_PATTERN = /\/retro\/([^/?#]+)/;
const MAX_VISIBLE_AVATARS = 3;
const ROOM_COUNT_PAD_LENGTH = 2;
const ROOM_COUNT_PAD_CHAR = '0';
const LOCAL_DATETIME_MINUTES_LENGTH = 16;
const INITIALS_PART_LIMIT = 2;
const UNKNOWN_PARTICIPANT_INITIAL = '?';

const FILLER_AVATAR_COLORS: readonly string[] = [
  'var(--color-landing-purple)',
  'var(--color-landing-yellow)',
  'var(--color-landing-green)',
];

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return UNKNOWN_PARTICIPANT_INITIAL;
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return (parts[0] ?? UNKNOWN_PARTICIPANT_INITIAL).slice(0, INITIALS_PART_LIMIT).toUpperCase();
  }
  return `${parts[0]?.charAt(0) ?? ''}${parts[1]?.charAt(0) ?? ''}`.toUpperCase();
}

function extractRoomIdFromInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const match = trimmed.match(ROOM_ID_FROM_URL_PATTERN);
  if (match !== null) {
    return match[1] ?? null;
  }
  return trimmed;
}

function formatRoomCount(count: number): string {
  return String(count).padStart(ROOM_COUNT_PAD_LENGTH, ROOM_COUNT_PAD_CHAR);
}

function formatLocalDateTime(iso: IRoomIndexEntry['createdAt']): string {
  return formatISO8601Local(iso).slice(0, LOCAL_DATETIME_MINUTES_LENGTH);
}

interface RoomAvatarsProps {
  readonly room: IRoomIndexEntry;
}

const RoomAvatars = observer(({ room }: RoomAvatarsProps) => {
  const directory = useUserDirectoryStore();
  const identityStore = useIdentityStore();
  const myClientId = identityStore.identity.clientId as ClientId;
  const ownerClientId = room.ownerClientId;
  const nonOwnerIds =
    ownerClientId !== null
      ? room.knownParticipantIds.filter(id => id !== ownerClientId)
      : room.knownParticipantIds;

  // Slot budget: 1 for the owner (when known) + the rest for participants.
  // Take the tail of the list so the most-recently-seen appear.
  const nonOwnerSlotBudget = ownerClientId !== null ? MAX_VISIBLE_AVATARS - 1 : MAX_VISIBLE_AVATARS;
  const visibleNonOwners = nonOwnerIds.slice(-nonOwnerSlotBudget);

  const totalParticipants = (ownerClientId !== null ? 1 : 0) + nonOwnerIds.length;
  const visibleCount = (ownerClientId !== null ? 1 : 0) + visibleNonOwners.length;
  const overflow = Math.max(0, totalParticipants - visibleCount);

  if (totalParticipants === 0) {
    return null;
  }

  const slots: {
    key: string;
    color: string;
    initials: string;
    isOwner: boolean;
    isMe: boolean;
    title: string;
  }[] = [];

  if (ownerClientId !== null) {
    const ownerProfile = directory.get(ownerClientId);
    const ownerName = ownerProfile?.name ?? '';
    slots.push({
      key: `owner-${ownerClientId}`,
      color: ownerProfile?.color ?? FILLER_AVATAR_COLORS[0],
      initials: initialsOf(ownerName),
      isOwner: true,
      isMe: ownerClientId === myClientId,
      title: ownerName,
    });
  }

  visibleNonOwners.forEach((clientId, index) => {
    const profile = directory.get(clientId);
    const fillerIndex = index % FILLER_AVATAR_COLORS.length;
    slots.push({
      key: `p-${clientId}`,
      color: profile?.color ?? FILLER_AVATAR_COLORS[fillerIndex],
      initials: profile !== null ? initialsOf(profile.name) : UNKNOWN_PARTICIPANT_INITIAL,
      isOwner: false,
      isMe: clientId === myClientId,
      title: profile?.name ?? '',
    });
  });

  return (
    <div className="flex items-center">
      {slots.map((slot, slotIndex) => (
        <span
          key={slot.key}
          className={cn(
            'relative inline-flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-landing-bg text-[10px] font-semibold text-landing-bg',
            slotIndex > 0 && '-ml-2',
            slot.isMe && 'z-10 ring-1 ring-landing-accent/60'
          )}
          style={{ backgroundColor: slot.color }}
          title={slot.title}
        >
          {slot.initials}
          {slot.isOwner && (
            <Crown
              size={10}
              className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-landing-yellow"
              aria-label={t.lobby.ownerBadgeTitle}
            />
          )}
        </span>
      ))}
      {overflow > 0 && (
        <span className="-ml-2 inline-flex h-[26px] items-center justify-center rounded-full border-2 border-landing-bg bg-landing-bg-elev px-2 font-mono text-[10px] text-landing-fg-dim">
          {t.lobby.membersOverflow.replace('{count}', String(overflow))}
        </span>
      )}
    </div>
  );
});

interface RoomRowProps {
  readonly room: IRoomIndexEntry;
  readonly isMine: boolean;
  readonly ownerDisplayName: string;
  readonly onDelete: (roomId: RoomId) => void;
}

const RoomRow = memo(({ room, isMine, ownerDisplayName, onDelete }: RoomRowProps) => {
  const handleDelete = useFunction((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onDelete(room.roomId);
  });

  return (
    <CardFrame hoverable className="relative">
      <NavLink
        to={`/retro/${room.roomId}`}
        className="flex items-center gap-6 px-6 py-5 text-landing-fg no-underline"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <MonoKicker tone="faint">{t.lobby.roomKicker}</MonoKicker>
            <span aria-hidden="true" className="font-mono text-[10px] text-landing-fg-faint">
              ·
            </span>
            <MonoKicker tone="faint">{formatLocalDateTime(room.createdAt)}</MonoKicker>
            {room.phase === ERetroPhase.Close && (
              <span className="border border-landing-purple/40 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.08em] text-landing-purple">
                {t.lobby.completedLabel}
              </span>
            )}
          </div>
          <div className="mt-1 truncate text-base font-medium text-landing-fg">{room.name}</div>
          <div className="mt-1 font-mono text-[11px] text-landing-fg-faint">
            {t.lobby.hostedBy}{' '}
            <span className="text-landing-fg-dim">
              {isMine ? t.lobby.youLabel : ownerDisplayName.length > 0 ? ownerDisplayName : '—'}
            </span>{' '}
            · {room.participantCount} {t.lobby.membersLabel}
          </div>
        </div>
        <RoomAvatars room={room} />
      </NavLink>
      <button
        type="button"
        onClick={handleDelete}
        aria-label={t.lobby.deleteButton}
        className="absolute top-2.5 right-2.5 flex h-6 w-6 items-center justify-center text-landing-fg-faint transition-colors hover:text-landing-red"
      >
        <X size={14} />
      </button>
    </CardFrame>
  );
});

interface IdentityChipProps {
  readonly name: string;
  readonly color: string;
  readonly hasName: boolean;
  readonly onEdit: () => void;
}

const IdentityChip = memo(({ name, color, hasName, onEdit }: IdentityChipProps) => (
  <button
    type="button"
    onClick={onEdit}
    className="flex items-center gap-2 border border-landing-border bg-landing-bg-elev/60 px-2 py-1.5 text-landing-fg transition-colors hover:border-landing-accent/40"
  >
    <span
      className="h-4 w-4 rounded-full border border-landing-border"
      style={{ backgroundColor: color }}
    />
    <span className="text-xs">{hasName ? name : t.identity.unsetPlaceholder}</span>
    <MonoKicker tone="faint">{hasName ? t.identity.editButton : t.identity.setButton}</MonoKicker>
  </button>
));

export const Lobby = observer(() => {
  const lobbyStore = useRetroLobbyStore();
  const identityStore = useIdentityStore();
  const directory = useUserDirectoryStore();
  const navigate = useNavigate();
  const myClientId = identityStore.identity.clientId as ClientId;
  const [joinInput, setJoinInput] = useState('');
  const [pendingDeleteRoomId, setPendingDeleteRoomId] = useState<RoomId | null>(null);
  const [isIdentityDialogOpen, setIsIdentityDialogOpen] = useState(false);

  useEffect(() => {
    void lobbyStore.loadRooms();
  }, [lobbyStore]);

  useEffect(() => {
    if (!identityStore.hasName) {
      setIsIdentityDialogOpen(true);
    }
  }, [identityStore.hasName]);

  const handleCreate = useFunction((params: ICreateRoomParams) => {
    const roomId = lobbyStore.createRoom(params, { ownerClientId: myClientId });
    lobbyStore.closeCreateDialog();
    void navigate(`/retro/${roomId}?created=1`);
  });

  const handleOpenCreateDialog = useFunction(() => {
    lobbyStore.openCreateDialog();
  });

  const handleCloseCreateDialog = useFunction(() => {
    lobbyStore.closeCreateDialog();
  });

  const handleJoinInputChange = useFunction((event: React.ChangeEvent<HTMLInputElement>) => {
    setJoinInput(event.target.value);
  });

  const handleJoinSubmit = useFunction((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const roomId = extractRoomIdFromInput(joinInput);
    if (roomId === null) {
      return;
    }
    void navigate(`/retro/${roomId}`);
  });

  const handleRequestDeleteRoom = useFunction((roomId: RoomId) => {
    setPendingDeleteRoomId(roomId);
  });

  const handleCancelDelete = useFunction(() => {
    setPendingDeleteRoomId(null);
  });

  const handleConfirmDelete = useFunction(() => {
    if (pendingDeleteRoomId === null) {
      return;
    }
    void lobbyStore.deleteRoom(pendingDeleteRoomId);
    setPendingDeleteRoomId(null);
  });

  const handleOpenIdentityDialog = useFunction(() => {
    setIsIdentityDialogOpen(true);
  });

  const handleIdentitySubmit = useFunction((params: { name: string; color: string }) => {
    identityStore.setName(params.name);
    identityStore.setColor(params.color);
    setIsIdentityDialogOpen(false);
  });

  const { rooms } = lobbyStore;
  const showLoader = !isSyncedValueDescriptor(rooms) && !isFailValueDescriptor(rooms);
  const hasSyncedRooms = isSyncedValueDescriptor(rooms);
  const roomList: readonly IRoomIndexEntry[] = hasSyncedRooms ? rooms.value : [];
  const activeRoomCount = roomList.length;

  const pendingDeleteRoomName =
    pendingDeleteRoomId !== null && hasSyncedRooms
      ? (roomList.find(room => room.roomId === pendingDeleteRoomId)?.name ?? '')
      : '';
  const deleteDialogTitle = t.lobby.deleteDialogTitle.replace('{name}', pendingDeleteRoomName);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[var(--container-narrow)] flex-col gap-12 px-6 pt-12 pb-20 sm:px-8">
        <section className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div className="min-w-0 flex-1">
              <h1 className="text-[clamp(40px,8vw,64px)] font-medium leading-[1.02] tracking-[-0.03em] text-landing-fg">
                {t.lobby.headlinePrimary}
                <br />
                <span className="font-serif text-landing-fg-faint italic">
                  {t.lobby.headlineAccent}
                </span>
              </h1>
              <p className="mt-5 max-w-[520px] text-[15px] leading-[1.5] text-landing-fg-dim">
                {t.lobby.heroSubtitle}
              </p>
            </div>
            <div className="flex flex-col items-end justify-between gap-5 self-stretch">
              <IdentityChip
                name={identityStore.identity.name}
                color={identityStore.identity.color}
                hasName={identityStore.hasName}
                onEdit={handleOpenIdentityDialog}
              />
              <div className="flex flex-col items-end gap-1.5">
                <MonoKicker tone="faint">{t.lobby.totalRoomsLabel}</MonoKicker>
                <div className="font-mono text-[52px] leading-none text-landing-fg">
                  {formatRoomCount(activeRoomCount)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-5">
          <SectionNumber number="01" label={t.lobby.activeRoomsSectionLabel} />

          {isFailValueDescriptor(rooms) && (
            <Alert type="error" message={t.errors.loadRoomsFailed} />
          )}

          {showLoader && (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          )}

          {hasSyncedRooms && roomList.length === 0 && (
            <div className="border border-dashed border-landing-border-soft bg-landing-bg-card/40 px-6 py-10 text-center font-mono text-xs text-landing-fg-faint">
              {t.lobby.noRoomsYet}
            </div>
          )}

          {hasSyncedRooms && roomList.length > 0 && (
            <ul className="flex flex-col gap-3">
              {roomList.map(room => {
                const isMine = room.ownerClientId === myClientId;
                const ownerClientId = room.ownerClientId;
                const ownerProfile = ownerClientId !== null ? directory.get(ownerClientId) : null;
                const ownerDisplayName =
                  ownerProfile !== null && ownerProfile.name.trim().length > 0
                    ? ownerProfile.name
                    : '';
                return (
                  <li key={room.roomId}>
                    <RoomRow
                      room={room}
                      isMine={isMine}
                      ownerDisplayName={ownerDisplayName}
                      onDelete={handleRequestDeleteRoom}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-5">
          <SectionNumber number="02" label={t.lobby.createOrJoinSectionLabel} />

          <CardFrame>
            <div className="flex items-center justify-between gap-4 px-6 py-5">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-landing-accent/40 text-landing-accent">
                  <Plus size={14} />
                </div>
                <div className="min-w-0">
                  <MonoKicker tone="faint">{t.lobby.newRetroCardKicker}</MonoKicker>
                  <div className="mt-1 text-sm font-medium text-landing-fg">
                    {t.lobby.startNewTitle}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-landing-fg-faint">
                    {t.lobby.startNewSubtitle}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleOpenCreateDialog}
                disabled={!identityStore.hasName}
                className="shrink-0 border-0 bg-landing-accent px-4 py-2 font-mono text-xs font-medium text-landing-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t.lobby.createSubmit} →
              </button>
            </div>
          </CardFrame>

          <CardFrame>
            <form onSubmit={handleJoinSubmit} className="flex flex-col gap-3 px-6 py-5">
              <div className="flex items-center gap-2">
                <Link2 size={14} className="text-landing-accent" />
                <MonoKicker tone="faint">{t.lobby.joinByLinkCardKicker}</MonoKicker>
              </div>
              <MonoKicker tone="faint" className="text-[10px]">
                {t.lobby.pasteLinkKicker}
              </MonoKicker>
              <div className="flex items-center gap-3">
                <input
                  id="retro-join-input"
                  type="text"
                  value={joinInput}
                  onChange={handleJoinInputChange}
                  placeholder={t.lobby.joinByLinkPlaceholder}
                  className="flex-1 border-0 border-b border-landing-border bg-transparent py-2 font-mono text-[15px] text-landing-fg placeholder:text-landing-fg-faint focus:border-landing-accent/40 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={joinInput.trim().length === 0}
                  className="shrink-0 border-0 bg-landing-accent px-4 py-2 font-mono text-xs font-medium text-landing-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t.lobby.joinSubmitShort} →
                </button>
              </div>
            </form>
          </CardFrame>
        </section>
      </div>

      <CreateRetroDialog
        open={lobbyStore.isCreateDialogOpen}
        onClose={handleCloseCreateDialog}
        onCreate={handleCreate}
      />

      <IdentityDialog
        open={isIdentityDialogOpen}
        initialName={identityStore.identity.name}
        initialColor={identityStore.identity.color}
        onSubmit={handleIdentitySubmit}
      />

      <ConfirmDialog
        open={pendingDeleteRoomId !== null}
        title={deleteDialogTitle}
        description={t.lobby.deleteDialogDescription}
        confirmLabel={t.lobby.deleteButton}
        cancelLabel={t.lobby.deleteCancel}
        tone="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
});
