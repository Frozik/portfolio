import { useFunction } from '@frozik/components';
import { isFailValueDescriptor, matchValueDescriptor } from '@frozik/utils';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSudoku } from 'sudoku-gen';
import { ValueDescriptorFail } from '../../../shared/components/ValueDescriptorFail';
import { cn } from '../../../shared/lib/cn';
import commonStyles from '../../../shared/styles.module.scss';
import { useSudokuStore } from '../application/useSudokuStore';
import type { TTool } from '../domain/types';
import type { DifficultyOption, SudokuDifficulty } from './components/DifficultyPicker';
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

  const handleToolSelect = useFunction((tool: TTool) => store.setTool(tool));

  const handleMarkField = useFunction(() => store.markField());

  const handleSelectPuzzleDifficulty = useFunction((value: SudokuDifficulty) => {
    const puzzle = getSudoku(value).puzzle.replace(/-/g, '0');

    navigate(`/sudoku/${puzzle}`);
  });

  const handleRestartGame = useFunction(() => navigate('/sudoku'));

  const handleRestorePreviousState = useFunction(() => store.restorePreviousState());

  const handleRestartPuzzle = useFunction(() => store.restartPuzzle());

  return (
    <div
      className={cn(
        'mx-auto flex min-h-0 select-none flex-col items-center justify-center max-[840px]:p-0',
        commonStyles.fixedContainer
      )}
    >
      {matchValueDescriptor(store.field, {
        synced: ({ value: field }) => (
          <SudokuField
            field={field}
            tool={store.tool}
            hasHistory={store.hasHistory}
            onRestorePreviousState={handleRestorePreviousState}
            onClickCell={handleClickCell}
            onChangeTool={handleToolSelect}
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
