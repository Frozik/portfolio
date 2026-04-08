import type { IDockviewPanelHeaderProps } from 'dockview';

import { DrawNeuralNetwork } from './components/DrawNeuralNetwork';
import { FitnessPlayground } from './components/FitnessPlayground';
import { GenerationsList } from './components/GenerationsList';
import { TestPlayground } from './components/TestPlayground';

export { ALL_LAYOUTS, DEFAULT_LAYOUT, getLayout } from '../domain/layoutConfig';

export const LAYOUT_COMPONENTS = {
  FitnessPlayground,
  GenerationsList,
  TestPlayground,
  DrawNeuralNetwork,
};

export const LAYOUT_TAB_COMPONENTS = {
  default: (props: IDockviewPanelHeaderProps<{ title: string }>) => {
    return (
      <div className="dv-default-tab">
        <div className="dv-default-tab-content">{props.params.title}</div>
      </div>
    );
  },
};
