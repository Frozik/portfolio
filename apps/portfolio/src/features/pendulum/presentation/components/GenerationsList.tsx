import { useFunction } from '@frozik/components/hooks/useFunction';
import { getNowISO8601 } from '@frozik/utils/date/now';
import type { ISO } from '@frozik/utils/date/types';
import {
  createSyncedValueDescriptor,
  isEmptyValueDescriptor,
  isFailValueDescriptor,
  isLoadingValueDescriptor,
  isSyncOrEmptyValueDescriptor,
  isWaitingArgumentsValueDescriptor,
  matchValueDescriptor,
} from '@frozik/utils/value-descriptors/utils';
import type { CellContext, ColumnDef, ColumnVisibilityState } from '@tanstack/react-table';
import { isNil } from 'lodash-es';
import { Bot, Network, Trash2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { ComponentProps } from 'react';
import { memo } from 'react';
import { Temporal } from 'temporal-polyfill';
import { OverlayLoader } from '../../../../shared/components/OverlayLoader';
import { ValueDescriptorFail as ValueDescriptorFailAlert } from '../../../../shared/components/ValueDescriptorFail';
import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import { Button } from '../../../../shared/ui/Button';
import type { TDataTableFeatures } from '../../../../shared/ui/DataTable';
import { DataTable } from '../../../../shared/ui/DataTable';
import { List } from '../../../../shared/ui/List';
import { Tag } from '../../../../shared/ui/Tag';
import { Tooltip } from '../../../../shared/ui/Tooltip';
import { usePendulumStore } from '../../application/usePendulumStore';
import type { IGeneration } from '../../domain/defs';
import { POPULATION_SIZE } from '../../domain/genetic/constants';
import { OVERLAY_MESSAGE_CONTAINER_CLASS } from '../constants';
import { pendulumT } from '../translations';

function getDateLocale(): string {
  return getCurrentLanguage() === 'ru' ? 'ru-RU' : 'en-GB';
}

type TGenerationPlayer = IGeneration['players'][number];

type TGenerationRow = {
  id: number;
  maxScore: number;
  players: TGenerationPlayer[];
};

function scoreTagColor(score: number): ComponentProps<typeof Tag>['color'] {
  if (score > 0) {
    return 'green';
  }
  if (score < 0) {
    return 'red';
  }
  return 'blue';
}

const ScoreCell = ({ getValue }: CellContext<TDataTableFeatures, TGenerationRow, unknown>) => {
  const maxScore = getValue<number>();
  return <Tag color={scoreTagColor(maxScore)}>{maxScore}</Tag>;
};

const PLAYER_ACTION_ICON_SIZE = 14;

const PlayerCellContent = memo(({ player }: { player: TGenerationPlayer }) => {
  const store = usePendulumStore();
  const handleSelectForTest = useFunction(() => store.setSelectedRobotId(player.name));
  const handleOpenNeuralNetwork = useFunction(() => store.openNeuralNetworkDialog(player.name));

  return (
    <div className="flex items-center gap-2">
      <Tag color={scoreTagColor(player.score)} className="shrink-0 whitespace-nowrap">
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

const PlayerCell = ({ getValue }: CellContext<TDataTableFeatures, TGenerationRow, unknown>) => {
  const player = getValue<TGenerationPlayer | undefined>();
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
                Temporal.Instant.from(startDate)
                  .toZonedDateTimeISO(Temporal.Now.timeZoneId())
                  .toLocaleString(getDateLocale(), COMPETITION_DATE_FORMAT)
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

const StartCompetitionPrompt = memo(({ onStart }: { onStart: VoidFunction }) => (
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
      <Button variant="primary" size="lg" onClick={onStart}>
        {pendulumT.generationsList.createNew}
      </Button>
    </Tooltip>
  </div>
));

const generationColumns: ColumnDef<TDataTableFeatures, TGenerationRow, unknown>[] = [
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
  ...Array.from({ length: POPULATION_SIZE }, (_, playerIndex) => ({
    id: `player-${playerIndex}`,
    accessorFn: ({ players }: TGenerationRow) => players[playerIndex],
    header: pendulumT.generationsList.columnPlayer(playerIndex + 1),
    size: 340,
    cell: PlayerCell,
  })),
];

export const GenerationsList = observer(() => {
  const store = usePendulumStore();

  const competitionsList = store.competitionsList;
  const currentCompetition = store.currentCompetition;
  const generations = store.generations;
  const maxPopulationSize = store.maxPopulationSize;

  const handleContinueCompetition = useFunction((competitionStart: ISO | undefined) => {
    if (isNil(competitionStart)) {
      store.setCurrentCompetition(
        createSyncedValueDescriptor({
          competitionStart: getNowISO8601(),
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
      <div className={OVERLAY_MESSAGE_CONTAINER_CLASS}>
        <OverlayLoader />
      </div>
    );
  }

  const competitionsDataSource: ('new' | ISO)[] = matchValueDescriptor(competitionsList, {
    synced: ({ value }) => ['new' as const, ...value],
    unsynced: vd => (isEmptyValueDescriptor(vd) ? ['new' as const] : []),
  });

  const columnVisibility: ColumnVisibilityState = {};
  for (let playerIndex = 0; playerIndex < POPULATION_SIZE; playerIndex++) {
    columnVisibility[`player-${playerIndex}`] = playerIndex < maxPopulationSize;
  }

  const generationRows: TGenerationRow[] = generations;

  const failedDescriptor = [competitionsList, currentCompetition].find(isFailValueDescriptor);

  const isCompetitionsListLoading = isLoadingValueDescriptor(competitionsList);
  const isCurrentCompetitionLoading = isLoadingValueDescriptor(currentCompetition);
  const isAnythingLoading = isCompetitionsListLoading || isCurrentCompetitionLoading;

  const hasCompetitionsToPick = competitionsDataSource.length > 1;
  const isCompetitionPending =
    isAnythingLoading || isWaitingArgumentsValueDescriptor(currentCompetition);
  const showsStartPrompt = !hasCompetitionsToPick && !isAnythingLoading;
  const showsGenerations =
    isSyncOrEmptyValueDescriptor(currentCompetition) &&
    isSyncOrEmptyValueDescriptor(competitionsList);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {!isNil(failedDescriptor) && <ValueDescriptorFailAlert fail={failedDescriptor.fail} />}

      {isCompetitionPending &&
        (showsStartPrompt ? (
          <StartCompetitionPrompt onStart={handleCreateNewCompetition} />
        ) : (
          <List
            className="absolute inset-0 overflow-auto p-3"
            loading={isAnythingLoading}
            dataSource={competitionsDataSource}
            renderItem={renderCompetitionItem}
          />
        ))}

      {showsGenerations && (
        <DataTable
          virtual
          data={generationRows}
          columns={generationColumns}
          columnVisibility={columnVisibility}
          initialSorting={[{ id: 'id', desc: true }]}
        />
      )}
    </div>
  );
});
