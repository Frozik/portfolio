import { cn } from '@frozik/components/components/cn';
import { memo } from 'react';
import { Link } from 'react-router-dom';

import type { PuzzleDefinition } from '../../domain/types';
import { SolutionPreview } from './SolutionPreview';

const PuzzleCardComponent = ({
  puzzle,
  shortName,
  previewLabel,
}: {
  readonly puzzle: PuzzleDefinition;
  readonly shortName: string;
  readonly previewLabel: string;
}) => (
  <Link
    to={`/stereometry/${puzzle.id}`}
    className={cn(
      'group block overflow-hidden rounded-[2px] border border-landing-border bg-landing-bg-card',
      'transition-all hover:-translate-y-1 hover:border-landing-accent/40',
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-landing-accent'
    )}
  >
    <div className="aspect-square w-full overflow-hidden bg-landing-bg-elev">
      <SolutionPreview puzzle={puzzle} label={previewLabel} className="h-full w-full" />
    </div>
    <div className="p-5 md:p-6">
      <h3 className="text-[20px] font-medium tracking-tight md:text-[22px]">{shortName}</h3>
    </div>
  </Link>
);

export const PuzzleCard = memo(PuzzleCardComponent);
