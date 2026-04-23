import { memo } from 'react';

import { PROJECT_ROUTES } from '../../contentData';
import { welcomeT } from '../../translations';
import { SectionHead } from '../common/SectionHead';
import { ProjectCard } from './ProjectCard';

const ProjectsComponent = () => (
  <section
    id="projects"
    className="relative mx-auto max-w-[var(--container-narrow)] scroll-mt-16 px-6 py-16 md:px-12 md:pb-20 md:pt-[120px] print:hidden"
  >
    <SectionHead
      number={welcomeT.projects.sectionNumber}
      kicker={welcomeT.projects.sectionKicker}
      title={welcomeT.projects.sectionTitle}
    />

    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-7">
      {PROJECT_ROUTES.map((entry, index) => {
        const content = welcomeT.projects.entries[entry.id];
        if (!content) {
          return null;
        }
        return (
          <ProjectCard
            key={entry.id}
            id={entry.id}
            route={entry.route}
            fx={entry.fx}
            content={content}
            index={index}
          />
        );
      })}
    </div>
  </section>
);

export const Projects = memo(ProjectsComponent);
