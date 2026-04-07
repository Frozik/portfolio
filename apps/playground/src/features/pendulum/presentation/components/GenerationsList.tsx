import { useFunction } from '@frozik/components';
import type { ISO, ValueDescriptorFail } from '@frozik/utils';
import {
  createSyncedValueDescriptor,
  isEmptyValueDescriptor,
  isFailValueDescriptor,
  isLoadingValueDescriptor,
  isSyncOrEmptyValueDescriptor,
  isWaitingArgumentsValueDescriptor,
  matchValueDescriptor,
} from '@frozik/utils';
import type { CellContext, ColumnDef, VisibilityState } from '@tanstack/react-table';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import type React from 'react';
import { memo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useResizeObserver } from 'usehooks-ts';
import { ValueDescriptorFail as ValueDescriptorFailAlert } from '../../../../shared/components/ValueDescriptorFail';
import { Badge, Button, DataTable, List, Tag } from '../../../../shared/ui';
import { usePendulumStore } from '../../application/usePendulumStore';
import styles from './GenerationsList.module.scss';

type TGenerationRow = Record<string, unknown> & {
  key: number;
  id: number;
  maxScore: number;
};

type TPlayerValue = { name: string; modelUrl: string; score: number } | undefined;

const MAX_PLAYER_COLUMNS = 30;

const ScoreCell = ({ getValue }: CellContext<TGenerationRow, unknown>) => {
  const maxScore = getValue<number>();
  return <Tag color={maxScore > 0 ? 'green' : maxScore < 0 ? 'red' : 'blue'}>{maxScore}</Tag>;
};

const PlayerCellContent = memo(({ player }: { player: { name: string; score: number } }) => {
  const navigate = useNavigate();
  const handleClick = useFunction(() => navigate(`/pendulum/${player.name}`));

  return (
    <Badge
      count={player.score}
      overflowCount={player.score}
      color={player.score > 0 ? 'green' : player.score < 0 ? 'red' : 'blue'}
    >
      <Button variant="link" onClick={handleClick}>
        {player.name}
      </Button>
    </Badge>
  );
});

const PlayerCell = ({ getValue }: CellContext<TGenerationRow, unknown>) => {
  const player = getValue() as TPlayerValue;
  if (isNil(player)) {
    return null;
  }
  return <PlayerCellContent player={player} />;
};

// Stable column definitions — created once, never changes
const generationColumns: ColumnDef<TGenerationRow, unknown>[] = [
  {
    accessorKey: 'id',
    header: '#',
    size: 80,
    enableSorting: true,
    meta: { fixed: 'left' as const },
  },
  {
    accessorKey: 'maxScore',
    header: 'Best score',
    size: 110,
    meta: { fixed: 'left' as const },
    cell: ScoreCell,
  },
  ...Array.from({ length: MAX_PLAYER_COLUMNS }, (_, index) => ({
    accessorKey: `player-${index}` as const,
    header: `Player #${index + 1}`,
    size: 340,
    cell: PlayerCell,
  })),
];

export const GenerationsList = observer(() => {
  const ref = useRef<HTMLDivElement>(null);
  useResizeObserver({
    ref: ref as React.RefObject<HTMLElement>,
    box: 'border-box',
  });

  const store = usePendulumStore();

  const competitionsList = store.competitionsList;
  const currentCompetition = store.currentCompetition;
  const generations = store.generations;
  const maxPopulationSize = store.maxPopulationSize;

  const handleContinueCompetition = useFunction((competitionStart: ISO | undefined) => {
    if (isNil(competitionStart)) {
      store.setCurrentCompetition(
        createSyncedValueDescriptor({
          competitionStart: new Date().toISOString() as ISO,
          generations: [],
        })
      );
    } else {
      store.loadCompetition(competitionStart);
    }
  });

  const competitionsDataSource: ('new' | ISO)[] = matchValueDescriptor(competitionsList, {
    synced: ({ value }) => ['new' as const, ...value],
    unsynced: vd => (isEmptyValueDescriptor(vd) ? ['new' as const] : []),
  });

  const columnVisibility: VisibilityState = {};
  for (let i = 0; i < MAX_PLAYER_COLUMNS; i++) {
    columnVisibility[`player-${i}`] = i < maxPopulationSize;
  }

  const generationDatasource: TGenerationRow[] = generations.map(
    ({ id, maxScore, players }) =>
      Object.assign(
        { key: id, id, maxScore },
        Object.fromEntries(players.map((player, i) => [`player-${i}`, player]))
      ) as TGenerationRow
  );

  return (
    <div ref={ref} className={styles.container}>
      {(isFailValueDescriptor(competitionsList) || isFailValueDescriptor(currentCompetition)) && (
        <ValueDescriptorFailAlert
          fail={(competitionsList.fail ?? currentCompetition.fail) as ValueDescriptorFail}
        />
      )}

      {(isLoadingValueDescriptor(currentCompetition) ||
        isWaitingArgumentsValueDescriptor(currentCompetition) ||
        isLoadingValueDescriptor(competitionsList) ||
        isWaitingArgumentsValueDescriptor(competitionsList)) && (
        <List
          className={styles.list}
          loading={
            isLoadingValueDescriptor(competitionsList) ||
            isLoadingValueDescriptor(currentCompetition)
          }
          dataSource={competitionsDataSource}
          renderItem={startDate => (
            <Button
              key="start"
              variant="link"
              size="sm"
              onClick={() => handleContinueCompetition(startDate === 'new' ? undefined : startDate)}
            >
              {startDate === 'new'
                ? 'Create New'
                : `Continue with ${new Date(startDate).toLocaleString('ru-RU', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`}
            </Button>
          )}
        />
      )}

      {isSyncOrEmptyValueDescriptor(currentCompetition) &&
        isSyncOrEmptyValueDescriptor(competitionsList) && (
          <DataTable
            virtual
            className={styles.grid}
            data={generationDatasource}
            columns={generationColumns}
            columnVisibility={columnVisibility}
            initialSorting={[{ id: 'id', desc: true }]}
          />
        )}
    </div>
  );
});
