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
  readonly id: string;
  readonly bias: number;
}

export interface IAxonDescriptor {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly weight: number;
}

export interface INeuronLayerDescriptor {
  readonly type: ELayerType.Neuron;
  readonly neuronLayerType: ENeuronLayerType;
  readonly neurons: readonly INeuronDescriptor[];
}

export interface IAxonLayerDescriptor {
  readonly type: ELayerType.Axon;
  readonly axons: readonly IAxonDescriptor[];
}

export type TLayerDescriptor = INeuronLayerDescriptor | IAxonLayerDescriptor;
