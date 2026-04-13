import type { ReactNode } from 'react';

export const pendulumTranslationsEn = {
  fitnessPlayground: {
    competitionNotStarted: 'Competition not started',
    description: (
      <>
        <p>
          This demo uses a genetic algorithm to evolve neural network weights that balance an
          inverted pendulum around the zero mark.
        </p>
        <ul>
          <li>
            Open the <strong>Generations</strong> tab and click <strong>Create New</strong> to start
            a new search, or select a previously saved training run to continue.
          </li>
          <li>
            The fitness function starts paused — press the <strong>play</strong> button to begin
            evolution.
          </li>
          <li>
            The generations table ranks neural networks by fitness score. Select any network to
            inspect it in the <strong>Test Playground</strong> or <strong>Neural Network</strong>{' '}
            tabs.
          </li>
          <li>
            In the test tab you can apply external force by clicking, holding, and dragging toward
            the pendulum weight.
          </li>
        </ul>
        <p>
          Simulation speed adapts automatically to available CPU performance while keeping the UI
          responsive.
        </p>
      </>
    ) as ReactNode,
  },
  generationsList: {
    createNew: 'Create New',
    continueWith: (dateString: string) => `Continue with ${dateString}`,
    columnId: '#',
    columnBestScore: 'Best score',
    columnPlayer: (index: number) => `Player #${index}`,
  },
  neuralNetwork: {
    selectRobotMessage:
      'Select a robot to display the structure of the neural network and its weights',
  },
  tabs: {
    fitnessPlayground: 'Fitness Playground',
    generations: 'Generations',
    testPlayground: 'Test Playground',
    neuralNetwork: 'Neural Network',
  },
} as const;
