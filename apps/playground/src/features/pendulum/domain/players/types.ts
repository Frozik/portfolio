export enum ELayerType {
  Neuron = 'neuron',
  Axon = 'axon',
}

export enum ENeuronLayerType {
  Input = 'input',
  Hidden = 'hidden',
  Output = 'output',
}

export interface INeuronDescriptor {
  id: string;
  bias: number;
}

export interface IAxonDescriptor {
  id: string;
  from: string;
  to: string;
  weight: number;
}

export interface INeuronLayerDescriptor {
  type: ELayerType.Neuron;
  neuronLayerType: ENeuronLayerType;
  neurons: INeuronDescriptor[];
}

export interface IAxonLayerDescriptor {
  type: ELayerType.Axon;
  axons: IAxonDescriptor[];
}

export type TLayerDescriptor = INeuronLayerDescriptor | IAxonLayerDescriptor;
