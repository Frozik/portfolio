import { isNil } from 'lodash-es';
import { memo } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '../../../../shared/lib/cn';

const PuzzleCardComponent = ({
  puzzleId,
  shortName,
  solutionImage,
  imageAlt,
}: {
  readonly puzzleId: string;
  readonly shortName: string;
  readonly solutionImage: string | undefined;
  readonly imageAlt: string;
}) => (
  <Link
    to={`/stereometry/${puzzleId}`}
    className={cn(
      'group block overflow-hidden rounded-[2px] border border-landing-border bg-landing-bg-card',
      'transition-all hover:-translate-y-1 hover:border-landing-accent/40',
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-landing-accent'
    )}
  >
    <div className="aspect-square w-full overflow-hidden bg-landing-bg-elev">
      {isNil(solutionImage) ? (
        <div className="h-full w-full" aria-hidden="true" />
      ) : (
        <img
          src={solutionImage}
          alt={imageAlt}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      )}
    </div>
    <div className="p-5 md:p-6">
      <h3 className="text-[20px] font-medium tracking-tight md:text-[22px]">{shortName}</h3>
    </div>
  </Link>
);

export const PuzzleCard = memo(PuzzleCardComponent);
