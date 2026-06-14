import type { ReactNode } from 'react';

import { Alert } from '../Alert';
import { SectionNumber } from '../SectionNumber';
import { Spinner } from '../Spinner';

interface RoomListSectionProps<TRoom> {
  readonly sectionNumber: string;
  readonly sectionLabel: string;
  /** Loading state — value descriptor neither synced nor failed yet. */
  readonly isLoading: boolean;
  /** Load failed — shows `errorMessage` in an error alert. */
  readonly isError: boolean;
  readonly errorMessage: string;
  /** Shown when the list synced to zero rooms. */
  readonly emptyMessage: string;
  /** Synced rooms; empty while loading or on error. */
  readonly rooms: readonly TRoom[];
  readonly getKey: (room: TRoom) => string;
  readonly renderRoom: (room: TRoom) => ReactNode;
}

/**
 * Shared "active rooms" lobby section: section marker, then exactly one of
 * error / loading / empty / list. The per-feature row markup is supplied via
 * `renderRoom`, so retro and conf share the surrounding state machine without
 * coupling to each other's room shape.
 */
export function RoomListSection<TRoom>({
  sectionNumber,
  sectionLabel,
  isLoading,
  isError,
  errorMessage,
  emptyMessage,
  rooms,
  getKey,
  renderRoom,
}: RoomListSectionProps<TRoom>) {
  return (
    <section className="flex flex-col gap-5">
      <SectionNumber number={sectionNumber} label={sectionLabel} />

      {isError && <Alert type="error" message={errorMessage} />}

      {isLoading && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}

      {!isLoading && !isError && rooms.length === 0 && (
        <div className="border border-dashed border-landing-border-soft bg-landing-bg-card/40 px-6 py-10 text-center font-mono text-xs text-landing-fg-faint">
          {emptyMessage}
        </div>
      )}

      {rooms.length > 0 && (
        <ul className="flex flex-col gap-3">
          {rooms.map(room => (
            <li key={getKey(room)}>{renderRoom(room)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
