import type { AddPanelOptions, SerializedDockview } from 'dockview';
import { Orientation } from 'dockview';
import { isNil } from 'lodash-es';

export const ALL_LAYOUTS: Pick<
  AddPanelOptions<{ title: string }>,
  'id' | 'component' | 'tabComponent' | 'params'
>[] = [
  {
    id: 'Fitness Playground',
    component: 'FitnessPlayground',
    tabComponent: 'default',
  },
  {
    id: 'Generations List',
    component: 'GenerationsList',
    tabComponent: 'default',
  },
  {
    id: 'Test Playground',
    component: 'TestPlayground',
  },
  {
    id: 'Neural Network',
    component: 'DrawNeuralNetwork',
  },
];

export const DEFAULT_LAYOUT: SerializedDockview = {
  grid: {
    root: {
      type: 'branch',
      data: [
        {
          type: 'leaf',
          data: {
            views: ['Fitness Playground'],
            activeView: 'Fitness Playground',
            id: '1',
          },
          size: 100,
        },
        {
          type: 'leaf',
          data: { views: ['Generations List'], activeView: 'Generations List', id: '2' },
          size: 100,
        },
        {
          type: 'branch',
          data: [
            {
              type: 'leaf',
              data: {
                views: ['Test Playground'],
                activeView: 'Test Playground',
                id: '3',
              },
              size: 100,
            },
            {
              type: 'leaf',
              data: {
                views: ['Neural Network'],
                activeView: 'Neural Network',
                id: '4',
              },
              size: 100,
            },
          ],
          size: 100,
        },
      ],
      size: 100,
    },
    width: 204,
    height: 308,
    orientation: Orientation.VERTICAL,
  },
  panels: {
    'Fitness Playground': {
      id: 'Fitness Playground',
      contentComponent: 'FitnessPlayground',
      tabComponent: 'default',
      params: { title: 'Fitness Playground' },
      title: 'Fitness Playground',
    },
    'Generations List': {
      id: 'Generations List',
      contentComponent: 'GenerationsList',
      tabComponent: 'default',
      params: { title: 'Generations' },
      title: 'Generations List',
    },
    'Test Playground': {
      id: 'Test Playground',
      contentComponent: 'TestPlayground',
      title: 'Test Playground',
    },
    'Neural Network': {
      id: 'Neural Network',
      contentComponent: 'DrawNeuralNetwork',
      title: 'Neural Network',
    },
  },
  activeGroup: '2',
};

export function getLayout(
  key: string
): Pick<AddPanelOptions<{ title: string }>, 'id' | 'component' | 'tabComponent' | 'params'> {
  const options = ALL_LAYOUTS.find(layout => layout.id === key);

  if (isNil(options)) {
    throw new Error(`Unknown layout tab: ${key}`);
  }

  return options;
}
