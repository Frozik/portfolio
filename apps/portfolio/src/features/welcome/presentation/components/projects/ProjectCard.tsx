import { useFunction } from '@frozik/components/hooks/useFunction';
import { memo, useState } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '../../../../../shared/lib/cn';
import type { IProjectTranslation } from '../../translations';
import type { TProjectFxKind } from './fx/types';
import { ProjectFx } from './ProjectFx';

const INDEX_PAD_SIZE = 2;

type ProjectCardProps = {
  readonly id: string;
  readonly route: string;
  readonly fx: TProjectFxKind;
  readonly content: IProjectTranslation;
  readonly index: number;
};

const ProjectCardComponent = ({ id, route, fx, content, index }: ProjectCardProps) => {
  const [hovered, setHovered] = useState(false);

  const handleEnter = useFunction(() => setHovered(true));
  const handleLeave = useFunction(() => setHovered(false));

  const numberLabel = String(index + 1).padStart(INDEX_PAD_SIZE, '0');

  return (
    <Link
      key={id}
      to={route}
      className={cn(
        'group relative block overflow-hidden rounded-[2px] border border-landing-border bg-landing-bg-card',
        'transition-all hover:-translate-y-1 hover:border-landing-accent/40'
      )}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-landing-bg-elev">
        <ProjectFx kind={fx} hovered={hovered} />
        <div
          aria-hidden="true"
          className="thumb-corners pointer-events-none absolute inset-[10px] z-[3] opacity-50 transition-[opacity,inset] duration-300 group-hover:inset-[8px] group-hover:opacity-100"
        />
      </div>

      <div className="relative z-[2] flex items-start justify-between gap-6 p-5 md:p-6">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wider text-landing-accent md:text-[11px]">
            {numberLabel} · {content.meta}
          </div>
          <h3 className="mb-2 text-[20px] font-medium tracking-tight md:text-[22px]">
            {content.title}
          </h3>
          <p className="text-[13.5px] font-light leading-[1.55] text-landing-fg-dim md:text-sm">
            {content.description}
          </p>
        </div>
        <div className="shrink-0 font-mono text-[10.5px] uppercase tracking-wider text-landing-fg-faint md:text-[11px]">
          {content.status}
        </div>
      </div>
    </Link>
  );
};

export const ProjectCard = memo(ProjectCardComponent);
