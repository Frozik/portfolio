import { memo } from 'react';

import { PUZZLES } from '../domain/puzzles/registry';
import { PuzzleCard } from './components/PuzzleCard';
import { stereometryT } from './translations';

type PuzzleTranslation = {
  readonly shortName: string;
  readonly name: string;
  readonly description: string;
};

const StereometryPickerComponent = () => {
  const puzzleTranslations: Record<string, PuzzleTranslation> = stereometryT.puzzles;

  return (
    <div className="mx-auto max-w-[var(--container-narrow)] px-6 py-12 md:px-12 md:py-16">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {PUZZLES.map(puzzle => {
          const translation = puzzleTranslations[puzzle.id];
          if (translation === undefined) {
            return null;
          }
          return (
            <PuzzleCard
              key={puzzle.id}
              puzzleId={puzzle.id}
              shortName={translation.shortName}
              solutionImage={puzzle.solutionImage}
              imageAlt={stereometryT.solutionImageAlt}
            />
          );
        })}
      </div>
    </div>
  );
};

export const StereometryPicker = memo(StereometryPickerComponent);
