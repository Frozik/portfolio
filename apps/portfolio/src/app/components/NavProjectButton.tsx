import { useFunction } from '@frozik/components/hooks/useFunction';
import { memo } from 'react';
import type { INavProject } from './navTypes';
import { PROJECT_ICON_SIZE_PX } from './navTypes';

export const NavProjectButton = memo(
  ({
    project,
    onSelect,
  }: {
    readonly project: INavProject;
    readonly onSelect: (route: string) => void;
  }) => {
    const Icon = project.icon;
    const handleClick = useFunction(() => {
      onSelect(project.route);
    });
    return (
      <li>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-sm border border-transparent px-3 py-3 text-left text-sm text-landing-fg-dim transition-colors hover:border-landing-border hover:text-landing-fg"
          onClick={handleClick}
        >
          <Icon
            size={PROJECT_ICON_SIZE_PX}
            className="shrink-0 text-landing-fg-faint"
            aria-hidden="true"
          />
          <span>{project.label}</span>
        </button>
      </li>
    );
  }
);
