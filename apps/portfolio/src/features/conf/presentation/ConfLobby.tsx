import { useFunction } from '@frozik/components';
import { formatISO8601Local, isFailValueDescriptor, isSyncedValueDescriptor } from '@frozik/utils';
import { Plus, Trash2, Video } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { ChangeEvent, FormEvent, MouseEvent } from 'react';
import { memo, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

import { cn } from '../../../shared/lib/cn';
import { Alert, Button, Spinner } from '../../../shared/ui';
import { useConfLobbyStore } from '../application/useConfLobbyStore';
import type { IConfRoomIndexEntry, RoomId } from '../domain';
import { ConfirmDialog } from './components/ConfirmDialog';
import { confT } from './translations';

const ROOM_ID_FROM_URL_PATTERN = /\/conf\/([^/?#]+)/;
const CREATED_QUERY_FLAG = '?created=1';

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

interface IRoomRowProps {
  readonly room: IConfRoomIndexEntry;
  readonly onDelete: (roomId: RoomId) => void;
}

const RoomRowComponent = ({ room, onDelete }: IRoomRowProps) => {
  const handleDeleteClick = useFunction((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onDelete(room.roomId);
  });
  return (
    <li
      className={cn(
        'group flex items-center gap-2 rounded-lg border border-border transition-colors',
        'hover:bg-surface-elevated'
      )}
    >
      <NavLink
        to={`/conf/${room.roomId}`}
        className="flex flex-1 items-center justify-between gap-4 p-4"
      >
        <div className="flex items-center gap-3">
          <Video size={16} className="text-text-muted" />
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-sm font-medium">{room.roomId}</span>
            <span className="text-xs text-text-muted">
              {confT.lobby.createdAt}: {formatISO8601Local(room.createdAt)}
              {room.lastVisitedAt !== room.createdAt && (
                <>
                  {' · '}
                  {confT.lobby.lastVisited}: {formatISO8601Local(room.lastVisitedAt)}
                </>
              )}
            </span>
          </div>
        </div>
      </NavLink>
      <button
        type="button"
        onClick={handleDeleteClick}
        aria-label={confT.lobby.deleteButton}
        className={cn(
          'mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
          'text-text-muted opacity-0 transition-all hover:bg-red-500/10',
          'hover:text-red-400 group-hover:opacity-100 focus:opacity-100'
        )}
      >
        <Trash2 size={14} />
      </button>
    </li>
  );
};

const RoomRow = memo(RoomRowComponent);

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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden p-4 text-text sm:p-8">
      <header className="flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{confT.lobby.title}</h1>
          <p className="text-sm text-text-muted sm:text-base">{confT.lobby.subtitle}</p>
        </div>
      </header>

      {isFailValueDescriptor(rooms) && (
        <Alert type="error" message={confT.errors.loadRoomsFailed} />
      )}

      {showLoader && (
        <div className="flex shrink-0 justify-center py-8">
          <Spinner />
        </div>
      )}

      {isSyncedValueDescriptor(rooms) && (
        <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
          <li>
            <button
              type="button"
              onClick={handleCreate}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-lg border border-dashed',
                'border-brand-500/40 bg-brand-500/5 p-4 text-sm font-medium text-brand-200',
                'transition-colors hover:bg-brand-500/10'
              )}
            >
              <Plus size={16} />
              {confT.lobby.createButton}
            </button>
          </li>
          {rooms.value.length === 0 && (
            <li className="py-8 text-center text-text-muted">{confT.lobby.emptyState}</li>
          )}
          {rooms.value.map(room => (
            <RoomRow key={room.roomId} room={room} onDelete={handleRequestDelete} />
          ))}
        </ul>
      )}

      <form
        className="flex shrink-0 flex-col gap-2 border-t border-border pt-6"
        onSubmit={handleJoinSubmit}
      >
        <label className="text-sm text-text-muted" htmlFor="conf-join-input">
          {confT.lobby.joinByLinkLabel}
        </label>
        <div className="flex gap-2">
          <input
            id="conf-join-input"
            type="text"
            value={joinInput}
            onChange={handleJoinInputChange}
            placeholder={confT.lobby.joinByLinkPlaceholder}
            className={cn(
              'h-9 flex-1 rounded-md border border-border bg-surface-elevated px-3 text-sm text-text',
              'placeholder:text-text-muted focus-visible:outline-none',
              'focus-visible:ring-2 focus-visible:ring-brand-500'
            )}
          />
          <Button type="submit" variant="secondary" disabled={joinInput.trim().length === 0}>
            {confT.lobby.joinSubmit}
          </Button>
        </div>
      </form>

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
