import { useFunction } from '@frozik/components/hooks/useFunction';
import { Home } from 'lucide-react';
import { memo } from 'react';
import { Drawer } from '../../shared/ui/Drawer';
import type { INavSectionTranslation } from '../translations';
import { GameOfLifeBackground } from './GameOfLifeBackground';
import { NavProjectButton } from './NavProjectButton';
import { NavSectionButton } from './NavSectionButton';
import type { INavProject } from './navTypes';
import { PROJECT_ICON_SIZE_PX } from './navTypes';

const NESTED_SECTION_BUTTON_CLASS =
  'flex w-full items-baseline gap-3 rounded-sm border border-transparent px-3 py-2 text-left font-mono text-sm text-landing-fg-dim transition-colors hover:border-landing-border hover:text-landing-fg';
const STANDALONE_SECTION_BUTTON_CLASS =
  'flex w-full items-baseline gap-3 rounded-sm border border-transparent px-3 py-3 text-left font-mono text-sm text-landing-fg-dim transition-colors hover:border-landing-border hover:text-landing-fg';

const MobileSectionMenuComponent = ({
  open,
  onClose,
  sections,
  showSections,
  projects,
  title,
  sectionsHeading,
  projectsHeading,
  backToHomeLabel,
  onNavigateSection,
  onNavigateProject,
  onNavigateHome,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly sections: readonly INavSectionTranslation[];
  readonly showSections: boolean;
  readonly projects: readonly INavProject[];
  readonly title: string;
  readonly sectionsHeading: string;
  readonly projectsHeading: string;
  readonly backToHomeLabel?: string;
  readonly onNavigateSection: (sectionId: string) => void;
  readonly onNavigateProject: (route: string) => void;
  readonly onNavigateHome?: () => void;
}) => {
  const handleSectionClick = useFunction((sectionId: string) => {
    onNavigateSection(sectionId);
    onClose();
  });

  const handleProjectClick = useFunction((route: string) => {
    onNavigateProject(route);
    onClose();
  });

  const handleHomeClick = useFunction(() => {
    onNavigateHome?.();
    onClose();
  });

  const showHomeLink =
    !showSections && onNavigateHome !== undefined && backToHomeLabel !== undefined;

  return (
    <Drawer open={open} onClose={onClose} placement="right" title={title}>
      <div className="relative flex min-h-full flex-col gap-6">
        <GameOfLifeBackground />
        {showHomeLink && (
          <section className="relative z-10 flex flex-col gap-1">
            <button
              type="button"
              onClick={handleHomeClick}
              className="flex w-full items-center gap-3 rounded-sm border border-transparent bg-transparent px-3 py-3 text-left text-sm text-landing-fg-dim transition-colors hover:border-landing-border hover:text-landing-fg"
            >
              <Home
                size={PROJECT_ICON_SIZE_PX}
                className="shrink-0 text-landing-fg-faint"
                aria-hidden="true"
              />
              <span>{backToHomeLabel}</span>
            </button>
            {sections.length > 0 && (
              <ul className="flex flex-col gap-1 pl-6">
                {sections.map(section => (
                  <NavSectionButton
                    key={section.id}
                    section={section}
                    className={NESTED_SECTION_BUTTON_CLASS}
                    onSelect={handleSectionClick}
                  />
                ))}
              </ul>
            )}
          </section>
        )}
        {showSections && sections.length > 0 && (
          <section className="relative z-10 flex flex-col gap-2 min-[990px]:hidden">
            <h3 className="font-mono text-[10px] tracking-[0.1em] text-landing-fg-faint uppercase">
              {sectionsHeading}
            </h3>
            <ul className="flex flex-col gap-1">
              {sections.map(section => (
                <NavSectionButton
                  key={section.id}
                  section={section}
                  className={STANDALONE_SECTION_BUTTON_CLASS}
                  onSelect={handleSectionClick}
                />
              ))}
            </ul>
          </section>
        )}

        <section className="relative z-10 flex flex-col gap-2">
          <h3 className="font-mono text-[10px] tracking-[0.1em] text-landing-fg-faint uppercase">
            {projectsHeading}
          </h3>
          <ul className="flex flex-col gap-1">
            {projects.map(project => (
              <NavProjectButton key={project.id} project={project} onSelect={handleProjectClick} />
            ))}
          </ul>
        </section>
      </div>
    </Drawer>
  );
};

export const MobileSectionMenu = memo(MobileSectionMenuComponent);
