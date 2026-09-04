import { useFunction } from '@frozik/components/hooks/useFunction';
import { isFailValueDescriptor, matchValueDescriptor } from '@frozik/utils/value-descriptors/utils';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { memo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRegisterTopNavBack } from '../../../app/components/TopNavBackContext';
import { ValueDescriptorFail } from '../../../shared/components/ValueDescriptorFail';
import { useSudokuStore } from '../application/useSudokuStore';
import type { SudokuDifficulty, ToolMode } from '../domain/types';
import type { DifficultyOption } from './components/DifficultyPicker';
import { DifficultyPicker } from './components/DifficultyPicker';
import { SudokuField } from './components/SudokuField';
import { sudokuT } from './translations';

const DIFFICULTY_OPTIONS: readonly DifficultyOption[] = [
  { value: 'easy', label: sudokuT.difficulty.easy, level: 1 },
  { value: 'medium', label: sudokuT.difficulty.medium, level: 2 },
  { value: 'hard', label: sudokuT.difficulty.hard, level: 3 },
  { value: 'expert', label: sudokuT.difficulty.expert, level: 4 },
];

export const Sudoku = observer(() => {
  const store = useSudokuStore();
  const navigate = useNavigate();

  const { puzzle } = useParams<{ puzzle: string | undefined }>();

  useEffect(() => {
    if (isNil(puzzle)) {
      store.resetPuzzle();
    } else {
      store.loadPuzzle(puzzle);
    }
  }, [puzzle, store]);

  const handleClickCell = useFunction((row: number, column: number) =>
    store.applyTool(row, column)
  );

  const handleSelectToolValue = useFunction((value: number) => store.setToolValue(value));

  const handleSelectToolMode = useFunction((mode: ToolMode) => store.setToolMode(mode));

  const handleMarkField = useFunction(() => store.markField());

  const handleSelectPuzzleDifficulty = useFunction((difficulty: SudokuDifficulty) => {
    navigate(`/sudoku/${store.createPuzzle(difficulty)}`);
  });

  const handleRestartGame = useFunction(() => navigate('/sudoku'));

  const isSolvingPuzzle = !isNil(puzzle);

  const handleRestorePreviousState = useFunction(() => store.restorePreviousState());

  const handleRestartPuzzle = useFunction(() => store.restartPuzzle());

  return (
    <div className="h-full w-full mx-auto flex min-h-0 select-none flex-col items-center justify-center max-[840px]:p-0">
      {isSolvingPuzzle && <SudokuBackNav onBack={handleRestartGame} />}
      {matchValueDescriptor(store.field, {
        synced: ({ value: field }) => (
          <SudokuField
            field={field}
            tool={store.tool}
            hasHistory={store.hasHistory}
            onRestorePreviousState={handleRestorePreviousState}
            onClickCell={handleClickCell}
            onSelectToolValue={handleSelectToolValue}
            onSelectToolMode={handleSelectToolMode}
            onMarkField={handleMarkField}
            onExitGame={handleRestartGame}
            onRestartGame={handleRestartPuzzle}
          />
        ),
        unsynced: vd =>
          isFailValueDescriptor(vd) ? (
            <ValueDescriptorFail fail={vd.fail} />
          ) : (
            <DifficultyPicker
              options={DIFFICULTY_OPTIONS}
              onSelect={handleSelectPuzzleDifficulty}
            />
          ),
      })}
    </div>
  );
});

const SudokuBackNav = memo(({ onBack }: { readonly onBack: () => void }) => {
  useRegisterTopNavBack({
    label: sudokuT.nav.backToDifficultyLabel,
    onActivate: onBack,
  });
  return null;
});
