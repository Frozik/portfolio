import { memo } from 'react';

import { MonoKicker } from '../../../../shared/ui/MonoKicker';
import type { IColumnConfig } from '../../domain/types';
import { retroT } from '../translations';

const COLUMN_NUMBER_PAD_LENGTH = 2;
const COLUMN_NUMBER_PAD_CHAR = '0';
const COLUMN_CODE_BASE_CHAR_CODE = 'A'.charCodeAt(0);

function formatColumnNumber(columnIndex: number): string {
  return String(columnIndex + 1).padStart(COLUMN_NUMBER_PAD_LENGTH, COLUMN_NUMBER_PAD_CHAR);
}

function formatColumnCode(columnIndex: number): string {
  return String.fromCharCode(COLUMN_CODE_BASE_CHAR_CODE + columnIndex);
}

const ColumnHeaderComponent = ({
  column,
  columnIndex,
  cardCount,
  totalVotes,
  typingPeersCount,
}: {
  readonly column: IColumnConfig;
  readonly columnIndex: number;
  readonly cardCount: number;
  readonly totalVotes: number;
  readonly typingPeersCount: number;
}) => (
  <>
    <div className="row-divider flex items-start justify-between gap-3 px-4 py-3.5">
      <div className="flex flex-col gap-1.5">
        <MonoKicker tone="faint" className="tracking-[0.12em]">
          {formatColumnNumber(columnIndex)} / {retroT.room.columnKicker}{' '}
          {formatColumnCode(columnIndex)}
        </MonoKicker>
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            // The accent is the template's per-column colour, known only at runtime.
            style={{ backgroundColor: column.color, boxShadow: `0 0 10px ${column.color}` }}
          />
          <h3 className="m-0 text-[15px] font-medium text-landing-fg">{column.title}</h3>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <MonoKicker tone="faint">{retroT.room.cardsVotesKicker}</MonoKicker>
        <div className="flex items-baseline gap-1 font-mono text-[15px] text-landing-fg">
          <span>{cardCount}</span>
          <span className="text-landing-fg-faint">·</span>
          <span>{totalVotes}</span>
        </div>
      </div>
    </div>

    {typingPeersCount > 0 && (
      <div className="row-divider px-4 py-2">
        <MonoKicker tone="faint" className="italic">
          {typingPeersCount === 1
            ? retroT.room.someoneIsWriting
            : `${typingPeersCount} ${retroT.room.multipleWriting}`}
        </MonoKicker>
      </div>
    )}
  </>
);

export const ColumnHeader = memo(ColumnHeaderComponent);
