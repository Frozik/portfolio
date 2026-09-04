import { useDroppable } from '@dnd-kit/core';

import type { ColumnId, GroupId } from '../../domain/types';

/** Drop target between two cards: where a dragged card lands and which group it joins. */
export interface IGapDropData {
  readonly type: 'gap';
  readonly targetColumnId: ColumnId;
  readonly targetIndex: number;
  readonly targetGroupId: GroupId | undefined;
}

export const GapDropZone = ({
  id,
  data,
  disabled,
}: {
  readonly id: string;
  readonly data: IGapDropData;
  readonly disabled: boolean;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id, data, disabled });
  return (
    <div ref={setNodeRef} aria-hidden="true" className="relative h-2 shrink-0">
      {isOver && (
        <div className="pointer-events-none absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-landing-accent" />
      )}
    </div>
  );
};
