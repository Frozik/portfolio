import '@frozik/table/theme/table.css';

import { clientRows } from '@frozik/table/core/rows/client-rows';
import { gridView } from '@frozik/table/extensions/grid-view/core';
import type { ICellContext } from '@frozik/table/react/column';
import { reactColumn } from '@frozik/table/react/column';
import { sorting } from '@frozik/table/react/extensions/sorting/sorting';
import { Table } from '@frozik/table/react/Table';
import { useTable } from '@frozik/table/react/useTable';
import type { ISO } from '@frozik/utils/date/types';
import {
  isEmptyValueDescriptor,
  isFailValueDescriptor,
  isLoadingValueDescriptor,
  isSyncOrEmptyValueDescriptor,
  isWaitingArgumentsValueDescriptor,
  matchValueDescriptor,
} from '@frozik/utils/value-descriptors/utils';
import { isNil } from 'lodash-es';
import { Trash2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { ComponentProps } from 'react';
import { memo, useMemo } from 'react';
import { Temporal } from 'temporal-polyfill';
import { useEventCallback } from 'usehooks-ts';
import { OverlayLoader } from '../../../../shared/components/OverlayLoader';
import { ValueDescriptorFail as ValueDescriptorFailAlert } from '../../../../shared/components/ValueDescriptorFail';
import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import { Button } from '../../../../shared/ui/Button';
import { List } from '../../../../shared/ui/List';
import { Tag } from '../../../../shared/ui/Tag';
import { Tooltip } from '../../../../shared/ui/Tooltip';
import { usePendulumStore } from '../../application/usePendulumStore';
import type { IGeneration, IGenerationPlayer } from '../../domain/generation';
import { POPULATION_SIZE } from '../../domain/genetic/constants';
import { OVERLAY_MESSAGE_CONTAINER_CLASS } from '../constants';
import { pendulumT } from '../translations';

function getDateLocale(): string {
  return getCurrentLanguage() === 'ru' ? 'ru-RU' : 'en-GB';
}

function scoreTagColor(score: number): ComponentProps<typeof Tag>['color'] {
  if (score > 0) {
    return 'green';
  }
  if (score < 0) {
    return 'red';
  }
  return 'blue';
}

const PLAYER_ACTION_ICON_SIZE = 14;

const define = reactColumn<IGeneration>();

const ScoreCell = ({ row }: ICellContext<IGeneration>) => (
  <Tag color={scoreTagColor(row.maxScore)}>{Math.round(row.maxScore)}</Tag>
);

const PlayerCellContent = memo(({ player }: { readonly player: IGenerationPlayer }) => {
  const store = usePendulumStore();
  const handleSelectForTest = useEventCallback(() => store.selectRobot(player.name));
  const handleOpenNeuralNetwork = useEventCallback(() =>
    store.openNeuralNetworkDialog(player.name)
  );

  return (
    <div className="flex items-center gap-2">
      <Tag color={scoreTagColor(player.score)} className="shrink-0 whitespace-nowrap">
        {Math.round(player.score)}
      </Tag>
      <Button
        variant="ghost"
        size="sm"
        className="text-landing-fg-dim transition-colors hover:text-landing-accent"
        aria-label={pendulumT.generationsList.useRobotInTest}
        title={pendulumT.generationsList.useRobotInTest}
        onClick={handleSelectForTest}
      >
        <span aria-hidden className="icon-mask icon-mask-bot size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-landing-fg-dim transition-colors hover:text-landing-accent"
        aria-label={pendulumT.generationsList.viewNeuralNetwork}
        title={pendulumT.generationsList.viewNeuralNetwork}
        onClick={handleOpenNeuralNetwork}
      >
        <span aria-hidden className="icon-mask icon-mask-network size-3.5" />
      </Button>
    </div>
  );
});

const playerCell =
  (playerIndex: number) =>
  ({ row }: ICellContext<IGeneration>) => {
    const player: IGenerationPlayer | undefined = row.players[playerIndex];
    return isNil(player) ? null : <PlayerCellContent player={player} />;
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
    readonly startDate: 'new' | ISO;
    readonly onContinue: (competitionStart: ISO | undefined) => void;
    readonly onDelete: (competitionStart: ISO) => void;
  }) => {
    const handleContinueClick = useEventCallback(() =>
      onContinue(startDate === 'new' ? undefined : startDate)
    );
    const handleDeleteClick = useEventCallback(() => {
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

const StartCompetitionPrompt = memo(({ onStart }: { readonly onStart: VoidFunction }) => (
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

const NEWEST_GENERATION_FIRST = {
  extensions: { sorting: [{ columnId: 'id', direction: 'desc' as const }] },
};

const ID_COLUMN_WIDTH = 80;
const SCORE_COLUMN_WIDTH = 110;
const PLAYER_COLUMN_WIDTH = 340;

/** Player columns beyond the population of the loaded competition stay hidden. */
function generationColumns(maxPopulationSize: number) {
  return [
    define({
      id: 'id',
      title: pendulumT.generationsList.columnId,
      kind: 'number',
      value: ({ id }) => id,
      width: ID_COLUMN_WIDTH,
      align: 'start',
    }),
    define({
      id: 'maxScore',
      title: pendulumT.generationsList.columnBestScore,
      kind: 'number',
      value: ({ maxScore }) => maxScore,
      cell: ScoreCell,
      width: SCORE_COLUMN_WIDTH,
      align: 'start',
      sort: false,
    }),
    ...Array.from({ length: POPULATION_SIZE }, (_, playerIndex) =>
      define({
        id: `player-${playerIndex}`,
        title: pendulumT.generationsList.columnPlayer(playerIndex + 1),
        kind: 'custom',
        value: ({ players }) => players[playerIndex],
        cell: playerCell(playerIndex),
        width: PLAYER_COLUMN_WIDTH,
        hidden: playerIndex >= maxPopulationSize,
        sort: false,
      })
    ),
  ];
}

export const GenerationsList = observer(() => {
  const store = usePendulumStore();

  const competitionsList = store.competitionsList;
  const currentCompetition = store.generations;
  const maxPopulationSize = store.maxPopulationSize;

  const handleContinueCompetition = useEventCallback((competitionStart: ISO | undefined) => {
    if (isNil(competitionStart)) {
      store.createCompetition();
    } else {
      store.loadCompetition(competitionStart);
    }
  });

  const handleDeleteCompetition = useEventCallback((competitionStart: ISO) => {
    store.deleteCompetition(competitionStart);
  });

  const renderCompetitionItem = useEventCallback((startDate: 'new' | ISO) => (
    <CompetitionListItem
      startDate={startDate}
      onContinue={handleContinueCompetition}
      onDelete={handleDeleteCompetition}
    />
  ));

  const columns = useMemo(() => generationColumns(maxPopulationSize), [maxPopulationSize]);
  const model = useTable({
    columns,
    rowKey: ({ id }) => String(id),
    rows: clientRows({
      rows: () =>
        matchValueDescriptor(store.generations, {
          synced: ({ value }) => value,
          unsynced: () => [],
        }),
    }),
    extensions: [gridView(), sorting({ cycle: ['desc', 'asc', null] })],
    initialState: NEWEST_GENERATION_FIRST,
    context: undefined,
  });

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
          <StartCompetitionPrompt onStart={store.createCompetition} />
        ) : (
          <List
            className="absolute inset-0 overflow-auto p-3"
            loading={isAnythingLoading}
            dataSource={competitionsDataSource}
            renderItem={renderCompetitionItem}
          />
        ))}

      {showsGenerations && (
        <Table
          model={model}
          className="h-full"
          theme="dark"
          hoverHighlight={false}
          focusable={false}
        />
      )}
    </div>
  );
});
