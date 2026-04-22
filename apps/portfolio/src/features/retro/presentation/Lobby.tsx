import { useFunction } from '@frozik/components';
import { formatISO8601Local, isFailValueDescriptor, isSyncedValueDescriptor } from '@frozik/utils';
import { Plus, Trash2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '../../../shared/lib/cn';
import { Alert, Button, Spinner } from '../../../shared/ui';
import type { ICreateRoomParams } from '../application/RetroLobbyStore';
import { useIdentityStore } from '../application/useIdentityStore';
import { useRetroLobbyStore } from '../application/useRetroLobbyStore';
import { useUserDirectoryStore } from '../application/useUserDirectoryStore';
import type { ClientId, RoomId } from '../domain/types';
import { ConfirmDialog } from './components/ConfirmDialog';
import { CreateRetroDialog } from './components/CreateRetroDialog';
import { IdentityDialog } from './components/IdentityDialog';
import { retroT as t } from './translations';

const ROOM_ID_FROM_URL_PATTERN = /\/retro\/([^/?#]+)/;

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

  const handleDeleteRoom = useFunction(
    (event: React.MouseEvent<HTMLButtonElement>, roomId: RoomId) => {
      event.preventDefault();
      event.stopPropagation();
      setPendingDeleteRoomId(roomId);
    }
  );

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

  const pendingDeleteRoomName =
    pendingDeleteRoomId !== null && isSyncedValueDescriptor(rooms)
      ? (rooms.value.find(room => room.roomId === pendingDeleteRoomId)?.name ?? '')
      : '';
  const deleteDialogTitle = t.lobby.deleteDialogTitle.replace('{name}', pendingDeleteRoomName);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden p-8 text-text">
      <header className="flex shrink-0 items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t.lobby.title}</h1>
          <p className="text-text-muted">{t.lobby.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenIdentityDialog}
            className="flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-sm text-text transition-colors hover:bg-surface-overlay"
          >
            <span
              className="h-5 w-5 rounded-full border border-border"
              style={{ backgroundColor: identityStore.identity.color }}
            />
            <span>
              {identityStore.hasName ? identityStore.identity.name : t.identity.unsetPlaceholder}
            </span>
            <span className="text-xs text-text-muted">
              {identityStore.hasName ? t.identity.editButton : t.identity.setButton}
            </span>
          </button>
          <Button onClick={handleOpenCreateDialog} disabled={!identityStore.hasName}>
            <Plus size={16} />
            {t.lobby.createButton}
          </Button>
        </div>
      </header>

      {isFailValueDescriptor(rooms) && <Alert type="error" message={t.errors.loadRoomsFailed} />}

      {showLoader && (
        <div className="flex shrink-0 justify-center py-8">
          <Spinner />
        </div>
      )}

      {isSyncedValueDescriptor(rooms) && (
        <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
          {rooms.value.length === 0 && (
            <li className="py-8 text-center text-text-muted">{t.lobby.emptyState}</li>
          )}
          {rooms.value.map(room => {
            const isMine = room.ownerClientId === myClientId;
            return (
              <li
                key={room.roomId}
                className={cn(
                  'group flex items-center gap-2 rounded-lg border transition-colors',
                  isMine
                    ? 'border-brand-500/50 bg-brand-500/10 hover:bg-brand-500/15'
                    : 'border-border hover:bg-surface-elevated'
                )}
              >
                <NavLink
                  to={`/retro/${room.roomId}`}
                  className="flex flex-1 items-center justify-between gap-4 p-4"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{room.name}</span>
                    <span className="text-xs text-text-muted">
                      {t.lobby.ownerLabel}:{' '}
                      {isMine
                        ? t.lobby.youLabel
                        : room.ownerClientId !== null &&
                            directory.getName(room.ownerClientId).length > 0
                          ? directory.getName(room.ownerClientId)
                          : '—'}{' '}
                      · {t.lobby.createdAt}: {formatISO8601Local(room.createdAt)}
                    </span>
                  </div>
                  <div className="text-xs text-text-muted">
                    {room.participantCount} {t.lobby.participantsSuffix}
                  </div>
                </NavLink>
                <button
                  type="button"
                  onClick={event => handleDeleteRoom(event, room.roomId)}
                  aria-label={t.lobby.deleteButton}
                  className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-muted opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 focus:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="flex shrink-0 flex-col gap-2 border-t border-border pt-6"
        onSubmit={handleJoinSubmit}
      >
        <label className="text-sm text-text-muted" htmlFor="retro-join-input">
          {t.lobby.joinByLinkLabel}
        </label>
        <div className="flex gap-2">
          <input
            id="retro-join-input"
            type="text"
            value={joinInput}
            onChange={handleJoinInputChange}
            placeholder={t.lobby.joinByLinkPlaceholder}
            className="h-9 flex-1 rounded-md border border-border bg-surface-elevated px-3 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          />
          <Button type="submit" variant="secondary">
            {t.lobby.joinSubmit}
          </Button>
        </div>
      </form>

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
