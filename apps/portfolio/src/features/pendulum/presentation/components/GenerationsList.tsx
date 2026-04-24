import { useFunction } from '@frozik/components/hooks/useFunction';
import type { ISO } from '@frozik/utils/date/types';
import type { ValueDescriptorFail } from '@frozik/utils/value-descriptors/types';
import {
  createSyncedValueDescriptor,
  isEmptyValueDescriptor,
  isFailValueDescriptor,
  isLoadingValueDescriptor,
  isSyncOrEmptyValueDescriptor,
  isWaitingArgumentsValueDescriptor,
  matchValueDescriptor,
} from '@frozik/utils/value-descriptors/utils';
import type { CellContext, ColumnDef, VisibilityState } from '@tanstack/react-table';
import { isNil } from 'lodash-es';
import { Bot, Network, Trash2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type React from 'react';
import { memo, useRef } from 'react';
import { useResizeObserver } from 'usehooks-ts';
import { OverlayLoader } from '../../../../shared/components/OverlayLoader';
import { ValueDescriptorFail as ValueDescriptorFailAlert } from '../../../../shared/components/ValueDescriptorFail';
import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import { Button } from '../../../../shared/ui/Button';
import { DataTable } from '../../../../shared/ui/DataTable';
import { List } from '../../../../shared/ui/List';
import { Tag } from '../../../../shared/ui/Tag';
import { Tooltip } from '../../../../shared/ui/Tooltip';
import { usePendulumStore } from '../../application/usePendulumStore';
import { pendulumT } from '../translations';
import commonStyles from './common.module.scss';

const DATE_LOCALE = getCurrentLanguage() === 'ru' ? 'ru-RU' : 'en-GB';

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

const PLAYER_ACTION_ICON_SIZE = 14;

const PlayerCellContent = memo(({ player }: { player: { name: string; score: number } }) => {
  const store = usePendulumStore();
  const handleSelectForTest = useFunction(() => store.setSelectedRobotId(player.name));
  const handleOpenNeuralNetwork = useFunction(() => store.openNeuralNetworkDialog(player.name));

  return (
    <div className="flex items-center gap-2">
      <Tag
        color={player.score > 0 ? 'green' : player.score < 0 ? 'red' : 'blue'}
        className="shrink-0 whitespace-nowrap"
      >
        {player.score}
      </Tag>
      <Button
        variant="ghost"
        size="sm"
        className="text-landing-fg-dim transition-colors hover:text-landing-accent"
        aria-label={pendulumT.generationsList.useRobotInTest}
        title={pendulumT.generationsList.useRobotInTest}
        onClick={handleSelectForTest}
      >
        <Bot size={PLAYER_ACTION_ICON_SIZE} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-landing-fg-dim transition-colors hover:text-landing-accent"
        aria-label={pendulumT.generationsList.viewNeuralNetwork}
        title={pendulumT.generationsList.viewNeuralNetwork}
        onClick={handleOpenNeuralNetwork}
      >
        <Network size={PLAYER_ACTION_ICON_SIZE} />
      </Button>
    </div>
  );
});

const PlayerCell = ({ getValue }: CellContext<TGenerationRow, unknown>) => {
  const player = getValue() as TPlayerValue;
  if (isNil(player)) {
    return null;
  }
  return <PlayerCellContent player={player} />;
};

const COMPETITION_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
};

const CompetitionListItem = memo(
  ({
    startDate,
    onContinue,
    onDelete,
  }: {
    startDate: 'new' | ISO;
    onContinue: (competitionStart: ISO | undefined) => void;
    onDelete: (competitionStart: ISO) => void;
  }) => {
    const handleContinueClick = useFunction(() =>
      onContinue(startDate === 'new' ? undefined : startDate)
    );
    const handleDeleteClick = useFunction(() => {
      if (startDate !== 'new') {
        onDelete(startDate);
      }
    });

    return (
      <div className="flex items-center gap-2">
        <Button variant="link" size="sm" onClick={handleContinueClick}>
          {startDate === 'new'
            ? pendulumT.generationsList.createNew
            : pendulumT.generationsList.continueWith(
                new Date(startDate).toLocaleString(DATE_LOCALE, COMPETITION_DATE_FORMAT)
              )}
        </Button>
        {startDate !== 'new' && (
          <Button
            variant="ghost"
            size="sm"
            className="text-landing-fg-dim transition-colors hover:text-red-500"
            aria-label={pendulumT.generationsList.deleteCompetition}
            title={pendulumT.generationsList.deleteCompetition}
            onClick={handleDeleteClick}
          >
            <Trash2 size={PLAYER_ACTION_ICON_SIZE} />
          </Button>
        )}
      </div>
    );
  }
);

const generationColumns: ColumnDef<TGenerationRow, unknown>[] = [
  {
    accessorKey: 'id',
    header: pendulumT.generationsList.columnId,
    size: 80,
    enableSorting: true,
  },
  {
    accessorKey: 'maxScore',
    header: pendulumT.generationsList.columnBestScore,
    size: 110,
    cell: ScoreCell,
  },
  ...Array.from({ length: MAX_PLAYER_COLUMNS }, (_, index) => ({
    accessorKey: `player-${index}` as const,
    header: pendulumT.generationsList.columnPlayer(index + 1),
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
    store.setPaused(false);
  });

  const handleDeleteCompetition = useFunction((competitionStart: ISO) => {
    store.deleteCompetition(competitionStart);
  });

  const handleCreateNewCompetition = useFunction(() => handleContinueCompetition(undefined));

  const renderCompetitionItem = useFunction((startDate: 'new' | ISO) => (
    <CompetitionListItem
      startDate={startDate}
      onContinue={handleContinueCompetition}
      onDelete={handleDeleteCompetition}
    />
  ));

  if (isWaitingArgumentsValueDescriptor(competitionsList)) {
    return (
      <div className={commonStyles.alertContainer}>
        <OverlayLoader />
      </div>
    );
  }

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
    <div ref={ref} className="relative h-full w-full overflow-hidden">
      {(isFailValueDescriptor(competitionsList) || isFailValueDescriptor(currentCompetition)) && (
        <ValueDescriptorFailAlert
          fail={(competitionsList.fail ?? currentCompetition.fail) as ValueDescriptorFail}
        />
      )}

      {(isLoadingValueDescriptor(currentCompetition) ||
        isWaitingArgumentsValueDescriptor(currentCompetition) ||
        isLoadingValueDescriptor(competitionsList) ||
        isWaitingArgumentsValueDescriptor(competitionsList)) &&
        (competitionsDataSource.length <= 1 &&
        !isLoadingValueDescriptor(competitionsList) &&
        !isLoadingValueDescriptor(currentCompetition) ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Tooltip
              open
              placement="bottom"
              className="max-w-xl px-4 py-3"
              title={
                <div className="space-y-2 text-left">
                  <div className="text-sm font-medium text-landing-fg">
                    {pendulumT.fitnessPlayground.competitionNotStarted}
                  </div>
                  <div className="text-xs text-landing-fg-dim">
                    {pendulumT.fitnessPlayground.description}
                  </div>
                </div>
              }
            >
              <Button variant="primary" size="lg" onClick={handleCreateNewCompetition}>
                {pendulumT.generationsList.createNew}
              </Button>
            </Tooltip>
          </div>
        ) : (
          <List
            className="absolute inset-0 overflow-auto p-3"
            loading={
              isLoadingValueDescriptor(competitionsList) ||
              isLoadingValueDescriptor(currentCompetition)
            }
            dataSource={competitionsDataSource}
            renderItem={renderCompetitionItem}
          />
        ))}

      {isSyncOrEmptyValueDescriptor(currentCompetition) &&
        isSyncOrEmptyValueDescriptor(competitionsList) && (
          <DataTable
            virtual
            data={generationDatasource}
            columns={generationColumns}
            columnVisibility={columnVisibility}
            initialSorting={[{ id: 'id', desc: true }]}
          />
        )}
    </div>
  );
});
