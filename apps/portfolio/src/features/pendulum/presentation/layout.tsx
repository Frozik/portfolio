import type { IDockviewPanelHeaderProps } from 'dockview';

import { DrawNeuralNetwork } from './components/DrawNeuralNetwork';
import { FitnessPlayground } from './components/FitnessPlayground';
import { GenerationsList } from './components/GenerationsList';
import { TestPlayground } from './components/TestPlayground';
import { pendulumT } from './translations';

export { ALL_LAYOUTS, DEFAULT_LAYOUT, getLayout } from '../domain/layoutConfig';

const TAB_TITLE_MAP: Record<string, string> = {
  'Fitness Playground': pendulumT.tabs.fitnessPlayground,
  'Generations List': pendulumT.tabs.generations,
  'Test Playground': pendulumT.tabs.testPlayground,
  'Neural Network': pendulumT.tabs.neuralNetwork,
};

export const LAYOUT_COMPONENTS = {
  FitnessPlayground,
  GenerationsList,
  TestPlayground,
  DrawNeuralNetwork,
};

export const LAYOUT_TAB_COMPONENTS = {
  default: (props: IDockviewPanelHeaderProps<{ title: string }>) => {
    const translatedTitle = TAB_TITLE_MAP[props.api.id] ?? props.params.title;

    return (
      <div className="dv-default-tab">
        <div className="dv-default-tab-content">{translatedTitle}</div>
      </div>
    );
  },
};
