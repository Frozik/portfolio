import type { VirtualTableColumn } from '@frozik/components/components/VirtualTable/VirtualTable';
import { VirtualTable } from '@frozik/components/components/VirtualTable/VirtualTable';
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

const ScoreCell = ({ maxScore }: IGeneration) => (
  <Tag color={scoreTagColor(maxScore)}>{Math.round(maxScore)}</Tag>
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

const playerCell = (playerIndex: number) => (generation: IGeneration) => {
  const player: IGenerationPlayer | undefined = generation.players[playerIndex];
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

const NEWEST_GENERATION_FIRST = { columnId: 'id', direction: 'desc' } as const;

const generationColumns: readonly VirtualTableColumn<IGeneration>[] = [
  {
    id: 'id',
    header: pendulumT.generationsList.columnId,
    value: ({ id }) => id,
    widthPx: 80,
    sortable: true,
  },
  {
    id: 'maxScore',
    header: pendulumT.generationsList.columnBestScore,
    value: ({ maxScore }) => maxScore,
    cell: ScoreCell,
    widthPx: 110,
  },
  ...Array.from({ length: POPULATION_SIZE }, (_, playerIndex) => ({
    id: `player-${playerIndex}`,
    header: pendulumT.generationsList.columnPlayer(playerIndex + 1),
    value: ({ players }: IGeneration) => players[playerIndex],
    cell: playerCell(playerIndex),
    widthPx: 340,
  })),
];

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

  // A fresh object here would change the columns' identity on every render,
  // and with it every row's props — the whole visible window would rebuild
  // each time a generation lands.
  const hiddenColumnIds = useMemo(() => {
    const hidden: Record<string, boolean> = {};
    for (let playerIndex = 0; playerIndex < POPULATION_SIZE; playerIndex += 1) {
      hidden[`player-${playerIndex}`] = playerIndex >= maxPopulationSize;
    }
    return hidden;
  }, [maxPopulationSize]);

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

  const generationRows = matchValueDescriptor(currentCompetition, {
    synced: ({ value }) => [...value],
    unsynced: () => [],
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
        <VirtualTable
          className="absolute inset-0 rounded-lg border border-border"
          rows={generationRows}
          columns={generationColumns}
          rowKey={({ id }) => String(id)}
          hiddenColumnIds={hiddenColumnIds}
          initialSort={NEWEST_GENERATION_FIRST}
        />
      )}
    </div>
  );
});
