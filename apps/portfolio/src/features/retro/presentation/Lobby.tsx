import { useFunction } from '@frozik/components/hooks/useFunction';
import {
  isFailValueDescriptor,
  isSyncedValueDescriptor,
} from '@frozik/utils/value-descriptors/utils';
import { isNil } from 'lodash-es';
import { Crown, X } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { memo, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AccountChip } from '../../../shared/communication/AccountChip';
import { cn } from '../../../shared/lib/cn';
import { CardFrame } from '../../../shared/ui/CardFrame';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { CreateRoomCard } from '../../../shared/ui/lobby/CreateRoomCard';
import { JoinByLinkCard } from '../../../shared/ui/lobby/JoinByLinkCard';
import { LobbyHero } from '../../../shared/ui/lobby/LobbyHero';
import { extractRoomIdFromInput, formatLocalDateTime } from '../../../shared/ui/lobby/lobbyFormat';
import { RoomListSection } from '../../../shared/ui/lobby/RoomListSection';
import { MonoKicker } from '../../../shared/ui/MonoKicker';
import { SectionNumber } from '../../../shared/ui/SectionNumber';
import type { ICreateRoomParams } from '../application/RetroLobbyStore';
import { useIdentityStore } from '../application/useIdentityStore';
import { useRetroLobbyStore } from '../application/useRetroLobbyStore';
import { useUserDirectoryStore } from '../application/useUserDirectoryStore';
import type { ClientId, IRoomIndexEntry, RoomId } from '../domain/types';
import { ERetroPhase } from '../domain/types';
import { CreateRetroDialog } from './components/CreateRetroDialog';
import { retroT as t } from './translations';

const ROOM_ID_FROM_URL_PATTERN = /\/retro\/([^/?#]+)/;
const MAX_VISIBLE_AVATARS = 3;
const INITIALS_PART_LIMIT = 2;
const UNKNOWN_PARTICIPANT_INITIAL = '?';

/**
 * Single neutral background for initials-only avatars (Yandex users
 * with no avatar set, or peers we haven't yet seen via awareness).
 * Per-user colors are gone — identity is derived entirely from OIDC.
 */
const FALLBACK_AVATAR_BG = 'var(--color-landing-accent)';

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

const RoomAvatars = observer(({ room }: { readonly room: IRoomIndexEntry }) => {
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
    pictureUrl?: string;
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
      pictureUrl: ownerProfile?.pictureUrl,
      initials: initialsOf(ownerName),
      isOwner: true,
      isMe: ownerClientId === myClientId,
      title: ownerName,
    });
  }

  visibleNonOwners.forEach(clientId => {
    const profile = directory.get(clientId);
    slots.push({
      key: `p-${clientId}`,
      pictureUrl: profile?.pictureUrl,
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
            'relative inline-flex h-[26px] w-[26px] items-center justify-center overflow-hidden rounded-full border-2 border-landing-bg text-[10px] font-semibold text-landing-bg',
            slotIndex > 0 && '-ml-2',
            slot.isMe && 'z-10 ring-1 ring-landing-accent/60'
          )}
          style={isNil(slot.pictureUrl) ? { backgroundColor: FALLBACK_AVATAR_BG } : undefined}
          title={slot.title}
        >
          {isNil(slot.pictureUrl) ? (
            slot.initials
          ) : (
            <img src={slot.pictureUrl} alt={slot.title} className="h-full w-full object-cover" />
          )}
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

const RoomRow = memo(
  ({
    room,
    isMine,
    ownerDisplayName,
    onDelete,
  }: {
    readonly room: IRoomIndexEntry;
    readonly isMine: boolean;
    readonly ownerDisplayName: string;
    readonly onDelete: (roomId: RoomId) => void;
  }) => {
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
  }
);

export const Lobby = observer(() => {
  const lobbyStore = useRetroLobbyStore();
  const identityStore = useIdentityStore();
  const directory = useUserDirectoryStore();
  const navigate = useNavigate();
  const myClientId = identityStore.identity.clientId as ClientId;
  const [joinInput, setJoinInput] = useState('');
  const [pendingDeleteRoomId, setPendingDeleteRoomId] = useState<RoomId | null>(null);

  useEffect(() => {
    void lobbyStore.loadRooms();
  }, [lobbyStore]);

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
    const roomId = extractRoomIdFromInput(joinInput, ROOM_ID_FROM_URL_PATTERN);
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

  const getRoomKey = useFunction((room: IRoomIndexEntry) => room.roomId);

  const renderRoom = useFunction((room: IRoomIndexEntry) => {
    const isMine = room.ownerClientId === myClientId;
    const ownerClientId = room.ownerClientId;
    const ownerProfile = ownerClientId !== null ? directory.get(ownerClientId) : null;
    const ownerDisplayName =
      ownerProfile !== null && ownerProfile.name.trim().length > 0 ? ownerProfile.name : '';
    return (
      <RoomRow
        room={room}
        isMine={isMine}
        ownerDisplayName={ownerDisplayName}
        onDelete={handleRequestDeleteRoom}
      />
    );
  });

  const { rooms } = lobbyStore;
  const isLoading = !isSyncedValueDescriptor(rooms) && !isFailValueDescriptor(rooms);
  const isError = isFailValueDescriptor(rooms);
  const roomList: readonly IRoomIndexEntry[] = isSyncedValueDescriptor(rooms) ? rooms.value : [];
  const activeRoomCount = roomList.length;

  const pendingDeleteRoomName =
    pendingDeleteRoomId !== null
      ? (roomList.find(room => room.roomId === pendingDeleteRoomId)?.name ?? '')
      : '';
  const deleteDialogTitle = t.lobby.deleteDialogTitle.replace('{name}', pendingDeleteRoomName);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[var(--container-narrow)] flex-col gap-12 px-6 pt-12 pb-20 sm:px-8">
        <LobbyHero
          headlinePrimary={t.lobby.headlinePrimary}
          headlineAccent={t.lobby.headlineAccent}
          heroSubtitle={t.lobby.heroSubtitle}
          totalRoomsLabel={t.lobby.totalRoomsLabel}
          roomCount={activeRoomCount}
          accessory={<AccountChip />}
        />

        <RoomListSection
          sectionNumber="01"
          sectionLabel={t.lobby.activeRoomsSectionLabel}
          isLoading={isLoading}
          isError={isError}
          errorMessage={t.errors.loadRoomsFailed}
          emptyMessage={t.lobby.noRoomsYet}
          rooms={roomList}
          getKey={getRoomKey}
          renderRoom={renderRoom}
        />

        <section className="flex flex-col gap-5">
          <SectionNumber number="02" label={t.lobby.createOrJoinSectionLabel} />

          <CreateRoomCard
            kicker={t.lobby.newRetroCardKicker}
            title={t.lobby.startNewTitle}
            subtitle={t.lobby.startNewSubtitle}
            buttonLabel={t.lobby.createSubmit}
            onAction={handleOpenCreateDialog}
          />

          <JoinByLinkCard
            inputId="retro-join-input"
            value={joinInput}
            onChange={handleJoinInputChange}
            onSubmit={handleJoinSubmit}
            kicker={t.lobby.joinByLinkCardKicker}
            pasteHint={t.lobby.pasteLinkKicker}
            placeholder={t.lobby.joinByLinkPlaceholder}
            submitLabel={t.lobby.joinSubmitShort}
          />
        </section>
      </div>

      <CreateRetroDialog
        open={lobbyStore.isCreateDialogOpen}
        onClose={handleCloseCreateDialog}
        onCreate={handleCreate}
      />

      <ConfirmDialog
        open={pendingDeleteRoomId !== null}
        kicker={t.confirm.kicker}
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
