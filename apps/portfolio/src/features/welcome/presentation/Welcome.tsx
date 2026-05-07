import { memo } from 'react';

import { TopNavCenterPortal } from '../../../app/components/TopNavCenterContext';

import { About } from './components/about/About';
import { Contact } from './components/contact/Contact';
import { Experience } from './components/experience/Experience';
import { Hero } from './components/hero/Hero';
import { LandingTopNavSections } from './components/LandingTopNavSections';
import { Projects } from './components/projects/Projects';
import { Skills } from './components/skills/Skills';
import { useHashScroll } from './hooks/useHashScroll';

const WelcomeComponent = () => {
  useHashScroll();

  return (
    <>
      <TopNavCenterPortal>
        <LandingTopNavSections />
      </TopNavCenterPortal>
      <Hero />
      <About />
      <Skills />
      <Experience />
      <Projects />
      <Contact />
    </>
  );
};

export const Welcome = memo(WelcomeComponent);
