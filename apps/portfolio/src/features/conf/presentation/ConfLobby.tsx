import { useFunction } from '@frozik/components/hooks/useFunction';
import {
  isFailValueDescriptor,
  isSyncedValueDescriptor,
} from '@frozik/utils/value-descriptors/utils';
import { X } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { ChangeEvent, FormEvent, MouseEvent } from 'react';
import { memo, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

import { CardFrame } from '../../../shared/ui/CardFrame';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { CreateRoomCard } from '../../../shared/ui/lobby/CreateRoomCard';
import { JoinByLinkCard } from '../../../shared/ui/lobby/JoinByLinkCard';
import { extractRoomIdFromInput, formatLocalDateTime } from '../../../shared/ui/lobby/lobbyFormat';
import { LobbyHero } from '../../../shared/ui/lobby/LobbyHero';
import { RoomListSection } from '../../../shared/ui/lobby/RoomListSection';
import { MonoKicker } from '../../../shared/ui/MonoKicker';
import { SectionNumber } from '../../../shared/ui/SectionNumber';
import type { ConfLobbyStore } from '../application/ConfLobbyStore';
import { useConfLobbyStore } from '../application/useConfLobbyStore';
import type { IConfRoomIndexEntry, RoomId } from '../domain/types';
import { ConfBackground } from './components/ConfBackground';
import { confT } from './translations';

const ROOM_ID_FROM_URL_PATTERN = /\/conf\/([^/?#]+)/;
const CREATED_QUERY_FLAG = '?created=1';

const RoomRow = memo(
  ({
    room,
    lobbyStore,
    onDelete,
  }: {
    readonly room: IConfRoomIndexEntry;
    readonly lobbyStore: ConfLobbyStore;
    readonly onDelete: (roomId: RoomId) => void;
  }) => {
    const handleDelete = useFunction((event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onDelete(room.roomId);
    });

    const isMine = lobbyStore.isOwnedByMe(room);

    return (
      <CardFrame hoverable className="relative">
        <NavLink
          to={`/conf/${room.roomId}`}
          className="flex items-center gap-6 px-6 py-5 text-landing-fg no-underline"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <MonoKicker tone="faint">{confT.lobby.roomKicker}</MonoKicker>
              <span aria-hidden="true" className="font-mono text-[10px] text-landing-fg-faint">
                ·
              </span>
              <MonoKicker tone="faint">{formatLocalDateTime(room.createdAt)}</MonoKicker>
            </div>
            <div className="mt-1 font-mono text-[11px] text-landing-fg-faint">
              {isMine ? confT.lobby.creatorMe : confT.lobby.creatorPeer}
            </div>
          </div>
        </NavLink>
        <button
          type="button"
          onClick={handleDelete}
          aria-label={confT.lobby.deleteButton}
          className="absolute top-2.5 right-2.5 flex h-6 w-6 items-center justify-center text-landing-fg-faint transition-colors hover:text-landing-red"
        >
          <X size={14} />
        </button>
      </CardFrame>
    );
  }
);

export const ConfLobby = observer(() => {
  const lobbyStore = useConfLobbyStore();
  const navigate = useNavigate();
  const [joinInput, setJoinInput] = useState('');
  const [pendingDeleteRoomId, setPendingDeleteRoomId] = useState<RoomId | null>(null);

  useEffect(() => {
    void lobbyStore.loadRooms();
  }, [lobbyStore]);

  const handleCreate = useFunction(() => {
    const roomId = lobbyStore.createRoom();
    void navigate(`/conf/${roomId}${CREATED_QUERY_FLAG}`);
  });

  const handleJoinInputChange = useFunction((event: ChangeEvent<HTMLInputElement>) => {
    setJoinInput(event.target.value);
  });

  const handleJoinSubmit = useFunction((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const roomId = extractRoomIdFromInput(joinInput, ROOM_ID_FROM_URL_PATTERN);
    if (roomId === null) {
      return;
    }
    void navigate(`/conf/${roomId}`);
  });

  const handleRequestDelete = useFunction((roomId: RoomId) => {
    setPendingDeleteRoomId(roomId);
  });

  const handleCancelDelete = useFunction(() => {
    setPendingDeleteRoomId(null);
  });

  const handleConfirmDelete = useFunction(() => {
    if (pendingDeleteRoomId === null) {
      return;
    }
    void lobbyStore.forgetRoom(pendingDeleteRoomId);
    setPendingDeleteRoomId(null);
  });

  const getRoomKey = useFunction((room: IConfRoomIndexEntry) => room.roomId);

  const renderRoom = useFunction((room: IConfRoomIndexEntry) => (
    <RoomRow room={room} lobbyStore={lobbyStore} onDelete={handleRequestDelete} />
  ));

  const { rooms } = lobbyStore;
  const isLoading = !isSyncedValueDescriptor(rooms) && !isFailValueDescriptor(rooms);
  const isError = isFailValueDescriptor(rooms);
  const roomList: readonly IConfRoomIndexEntry[] = isSyncedValueDescriptor(rooms)
    ? rooms.value
    : [];
  const activeRoomCount = roomList.length;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="pointer-events-none absolute inset-0 z-0">
        <ConfBackground />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[var(--container-narrow)] flex-col gap-12 px-6 pt-12 pb-20 sm:px-8">
        <LobbyHero
          sectionNumber="01"
          sectionLabel={confT.lobby.sectionKicker}
          headlinePrimary={confT.lobby.headlinePrimary}
          headlineAccent={confT.lobby.headlineAccent}
          heroSubtitle={confT.lobby.heroSubtitle}
          totalRoomsLabel={confT.lobby.totalRoomsLabel}
          roomCount={activeRoomCount}
        />

        <RoomListSection
          sectionNumber="02"
          sectionLabel={confT.lobby.activeRoomsSectionLabel}
          isLoading={isLoading}
          isError={isError}
          errorMessage={confT.errors.loadRoomsFailed}
          emptyMessage={confT.lobby.noRoomsYet}
          rooms={roomList}
          getKey={getRoomKey}
          renderRoom={renderRoom}
        />

        <section className="flex flex-col gap-5">
          <SectionNumber number="03" label={confT.lobby.createOrJoinSectionLabel} />

          <CreateRoomCard
            kicker={confT.lobby.newRetroCardKicker}
            title={confT.lobby.startNewTitle}
            subtitle={confT.lobby.startNewSubtitle}
            buttonLabel={confT.lobby.createSubmit}
            onAction={handleCreate}
          />

          <JoinByLinkCard
            inputId="conf-join-input"
            value={joinInput}
            onChange={handleJoinInputChange}
            onSubmit={handleJoinSubmit}
            kicker={confT.lobby.joinByLinkCardKicker}
            pasteHint={confT.lobby.pasteLinkKicker}
            placeholder={confT.lobby.joinByLinkPlaceholder}
            submitLabel={confT.lobby.joinSubmitShort}
          />
        </section>
      </div>

      <ConfirmDialog
        open={pendingDeleteRoomId !== null}
        title={confT.lobby.deleteDialogTitle}
        description={confT.lobby.deleteDialogDescription}
        confirmLabel={confT.lobby.deleteButton}
        cancelLabel={confT.lobby.deleteCancel}
        tone="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
});
