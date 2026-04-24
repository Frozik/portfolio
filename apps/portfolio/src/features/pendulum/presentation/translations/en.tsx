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
            Click <strong>Create New Competition</strong> to start a new search, or pick a
            previously saved training run to continue.
          </li>
          <li>
            The top <strong>Fitness Playground</strong> panel shows the search in progress as the
            network learns to balance the pendulum. Use the pause button to suspend the search.
          </li>
          <li>
            In the <strong>Test Playground</strong> panel you can try to balance the pendulum
            yourself, or watch how it's done by a robot picked from the <strong>Generations</strong>{' '}
            panel.
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
    useRobotInTest: 'Use in test playground',
    viewNeuralNetwork: 'View neural network',
    deleteCompetition: 'Delete competition',
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
