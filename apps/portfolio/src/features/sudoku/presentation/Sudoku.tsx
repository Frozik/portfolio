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
import { RadioGroup } from '../../../shared/ui';
import { useSudokuStore } from '../application/useSudokuStore';
import type { TTool } from '../domain/types';
import { SudokuField } from './components/SudokuField';
import styles from './Sudoku.module.scss';
import { sudokuT } from './translations';

const DIFFICULTY_OPTIONS = [
  { label: sudokuT.difficulty.easy, value: 'easy' },
  { label: sudokuT.difficulty.medium, value: 'medium' },
  { label: sudokuT.difficulty.hard, value: 'hard' },
  { label: sudokuT.difficulty.expert, value: 'expert' },
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

  const handleSelectPuzzleDifficulty = useFunction((value: string) => {
    const puzzle = getSudoku(value as 'easy' | 'medium' | 'hard' | 'expert').puzzle.replace(
      /-/g,
      '0'
    );

    navigate(`/sudoku/${puzzle}`);
  });

  const handleRestartGame = useFunction(() => navigate('/sudoku'));

  const handleRestorePreviousState = useFunction(() => store.restorePreviousState());

  const handleRestartPuzzle = useFunction(() => store.restartPuzzle());

  return (
    <div className={cn(styles.container, commonStyles.fixedContainer)}>
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
            <RadioGroup
              options={DIFFICULTY_OPTIONS}
              value=""
              onChange={handleSelectPuzzleDifficulty}
              optionType="button"
            />
          ),
      })}
    </div>
  );
});
