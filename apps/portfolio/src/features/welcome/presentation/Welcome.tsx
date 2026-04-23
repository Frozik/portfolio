import { memo } from 'react';

import { About } from './components/about/About';
import { Contact } from './components/contact/Contact';
import { Experience } from './components/experience/Experience';
import { Hero } from './components/hero/Hero';
import { Projects } from './components/projects/Projects';
import { Skills } from './components/skills/Skills';
import { useHashScroll } from './hooks/useHashScroll';

const WelcomeComponent = () => {
  useHashScroll();

  return (
    <>
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
