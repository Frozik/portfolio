import { useFunction } from '@frozik/components/hooks/useFunction';
import { formatISO8601Local } from '@frozik/utils/date/format';
import {
  isFailValueDescriptor,
  isSyncedValueDescriptor,
} from '@frozik/utils/value-descriptors/utils';
import { Link2, Plus, X } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { ChangeEvent, FormEvent, MouseEvent } from 'react';
import { memo, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

import { cn } from '../../../shared/lib/cn';
import { Alert } from '../../../shared/ui/Alert';
import { CardFrame } from '../../../shared/ui/CardFrame';
import { MonoKicker } from '../../../shared/ui/MonoKicker';
import { SectionNumber } from '../../../shared/ui/SectionNumber';
import { Spinner } from '../../../shared/ui/Spinner';
import type { ConfLobbyStore } from '../application/ConfLobbyStore';
import { useConfLobbyStore } from '../application/useConfLobbyStore';
import type { IConfRoomIndexEntry, RoomId } from '../domain/types';
import { ConfBackground } from './components/ConfBackground';
import { ConfirmDialog } from './components/ConfirmDialog';
import { confT } from './translations';

const ROOM_ID_FROM_URL_PATTERN = /\/conf\/([^/?#]+)/;
const CREATED_QUERY_FLAG = '?created=1';
const ROOM_COUNT_PAD_LENGTH = 2;
const ROOM_COUNT_PAD_CHAR = '0';
const LOCAL_DATETIME_MINUTES_LENGTH = 16;

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

function formatLocalDateTime(iso: IConfRoomIndexEntry['createdAt']): string {
  return formatISO8601Local(iso).slice(0, LOCAL_DATETIME_MINUTES_LENGTH);
}

interface IRoomRowProps {
  readonly room: IConfRoomIndexEntry;
  readonly lobbyStore: ConfLobbyStore;
  readonly onDelete: (roomId: RoomId) => void;
}

const RoomRow = memo(({ room, lobbyStore, onDelete }: IRoomRowProps) => {
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
});

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
    const roomId = extractRoomIdFromInput(joinInput);
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

  const { rooms } = lobbyStore;
  const showLoader = !isSyncedValueDescriptor(rooms) && !isFailValueDescriptor(rooms);
  const hasSyncedRooms = isSyncedValueDescriptor(rooms);
  const roomList: readonly IConfRoomIndexEntry[] = hasSyncedRooms ? rooms.value : [];
  const activeRoomCount = roomList.length;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="pointer-events-none absolute inset-0 z-0">
        <ConfBackground />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[var(--container-narrow)] flex-col gap-12 px-6 pt-12 pb-20 sm:px-8">
        <section className="flex flex-col gap-6">
          <SectionNumber number="01" label={confT.lobby.sectionKicker} />
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div className="min-w-0 flex-1">
              <h1 className="text-[clamp(40px,8vw,64px)] font-medium leading-[1.02] tracking-[-0.03em] text-landing-fg">
                {confT.lobby.headlinePrimary}
                <br />
                <span className="font-serif text-landing-fg-faint italic">
                  {confT.lobby.headlineAccent}
                </span>
              </h1>
              <p className="mt-5 max-w-[520px] text-[15px] leading-[1.5] text-landing-fg-dim">
                {confT.lobby.heroSubtitle}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <MonoKicker tone="faint">{confT.lobby.totalRoomsLabel}</MonoKicker>
              <div className="font-mono text-[52px] leading-none text-landing-fg">
                {formatRoomCount(activeRoomCount)}
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-5">
          <SectionNumber number="02" label={confT.lobby.activeRoomsSectionLabel} />

          {isFailValueDescriptor(rooms) && (
            <Alert type="error" message={confT.errors.loadRoomsFailed} />
          )}

          {showLoader && (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          )}

          {hasSyncedRooms && roomList.length === 0 && (
            <div className="border border-dashed border-landing-border-soft bg-landing-bg-card/40 px-6 py-10 text-center font-mono text-xs text-landing-fg-faint">
              {confT.lobby.noRoomsYet}
            </div>
          )}

          {hasSyncedRooms && roomList.length > 0 && (
            <ul className="flex flex-col gap-3">
              {roomList.map(room => (
                <li key={room.roomId}>
                  <RoomRow room={room} lobbyStore={lobbyStore} onDelete={handleRequestDelete} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-5">
          <SectionNumber number="03" label={confT.lobby.createOrJoinSectionLabel} />

          <CardFrame>
            <div className="flex items-center justify-between gap-4 px-6 py-5">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-landing-accent/40 text-landing-accent">
                  <Plus size={14} />
                </div>
                <div className="min-w-0">
                  <MonoKicker tone="faint">{confT.lobby.newRetroCardKicker}</MonoKicker>
                  <div className="mt-1 text-sm font-medium text-landing-fg">
                    {confT.lobby.startNewTitle}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-landing-fg-faint">
                    {confT.lobby.startNewSubtitle}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCreate}
                className="shrink-0 border-0 bg-landing-accent px-4 py-2 font-mono text-xs font-medium text-landing-bg transition-opacity hover:opacity-90"
              >
                {confT.lobby.createSubmit} →
              </button>
            </div>
          </CardFrame>

          <CardFrame>
            <form onSubmit={handleJoinSubmit} className="flex flex-col gap-3 px-6 py-5">
              <div className="flex items-center gap-2">
                <Link2 size={14} className="text-landing-accent" />
                <MonoKicker tone="faint">{confT.lobby.joinByLinkCardKicker}</MonoKicker>
              </div>
              <MonoKicker tone="faint" className="text-[10px]">
                {confT.lobby.pasteLinkKicker}
              </MonoKicker>
              <div className="flex items-center gap-3">
                <input
                  id="conf-join-input"
                  type="text"
                  value={joinInput}
                  onChange={handleJoinInputChange}
                  placeholder={confT.lobby.joinByLinkPlaceholder}
                  className={cn(
                    'flex-1 border-0 border-b border-landing-border bg-transparent py-2 font-mono text-[15px] text-landing-fg',
                    'placeholder:text-landing-fg-faint focus:border-landing-accent/40 focus:outline-none'
                  )}
                />
                <button
                  type="submit"
                  disabled={joinInput.trim().length === 0}
                  className="shrink-0 border-0 bg-landing-accent px-4 py-2 font-mono text-xs font-medium text-landing-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {confT.lobby.joinSubmitShort} →
                </button>
              </div>
            </form>
          </CardFrame>
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
