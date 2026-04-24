import type { LayersModel, Tensor } from '@tensorflow/tfjs';
import {
  layers,
  loadLayersModel,
  randomNormal,
  sequential,
  setBackend,
  tensor,
  tensor2d,
  tidy,
} from '@tensorflow/tfjs';
import type { ModelArtifacts, SaveResult } from '@tensorflow/tfjs-core/dist/io/types';
import { isNil, round } from 'lodash-es';
import { Vector } from 'matter-js';
import { ulid } from 'ulidx';
import { v4 as uuidv4 } from 'uuid';

import { RAILS_HALF_LENGTH } from '../constants';
import type { IAction, IRobotPlayer, IWorld } from '../types';
import { EPlayerType } from '../types';
import { zNormalization } from '../utils';
import type { TLayerDescriptor } from './types';
import { ELayerType, ENeuronLayerType } from './types';

setBackend('cpu');

export const MAX_PIVOT_VELOCITY = 1;

const MAX_BOB_VELOCITY = 50;
const MAX_MUTATION_RATE = 0.2;
const MUTATION_RATE_PRECISION = 4;

export class TensorflowPlayer implements IRobotPlayer {
  private readonly model: LayersModel;
  private disposed = false;

  readonly type = EPlayerType.Robot;
  readonly name: string;

  constructor(name?: string, model?: LayersModel) {
    this.model = model ?? this.init();
    this.name = name ?? ulid();
  }

  static async load(name: string, url: string): Promise<TensorflowPlayer> {
    const model = await loadLayersModel(url);
    return new TensorflowPlayer(name, model);
  }

  init(): LayersModel {
    const model = sequential();

    model.add(
      layers.dense({
        inputShape: [4],
        units: 10,
        activation: 'relu',
      })
    );

    model.add(
      layers.dense({
        units: 10,
        activation: 'linear',
      })
    );

    model.add(
      layers.dense({
        units: 1,
        activation: 'tanh',
      })
    );

    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
    });

    return model;
  }

  public getModelDescription(): TLayerDescriptor[] {
    const layers: TLayerDescriptor[] = [];

    tidy(() => {
      let leftNeuronIds: string[] | undefined;

      this.model.layers.forEach((layer, index, { length }) => {
        layer.getWeights().forEach(weight => {
          if (weight.shape.length === 2) {
            const leftSize = weight.shape[0];
            const rightSize = weight.shape[1];

            const currentLeftNeuronIds =
              leftNeuronIds ?? new Array(leftSize).fill(0).map(() => uuidv4());
            const rightNeuronIds = new Array(rightSize).fill(0).map(() => uuidv4());

            if (layers.length === 0) {
              layers.push({
                type: ELayerType.Neuron,
                neuronLayerType: ENeuronLayerType.Input,
                neurons: new Array(leftSize).fill(0).map((_, index) => ({
                  id: currentLeftNeuronIds[index],
                  bias: 0,
                })),
              });
            }

            const weights = weight.arraySync() as number[][];

            layers.push({
              type: ELayerType.Axon,
              axons: new Array(leftSize * rightSize).fill(0).map((_, index) => {
                const leftIndex = Math.trunc(index / rightSize);
                const rightIndex = index % rightSize;

                return {
                  id: uuidv4(),
                  from: currentLeftNeuronIds[leftIndex],
                  to: rightNeuronIds[rightIndex],
                  weight: weights[leftIndex][rightIndex],
                };
              }),
            });

            layers.push({
              type: ELayerType.Neuron,
              neuronLayerType:
                index === length - 1 ? ENeuronLayerType.Output : ENeuronLayerType.Hidden,
              neurons: new Array(rightSize).fill(0).map((_, index) => ({
                id: rightNeuronIds[index],
                bias: 0,
              })),
            });

            leftNeuronIds = rightNeuronIds;
          } else {
            const neuronLayer = layers.at(-1) as TLayerDescriptor | undefined;

            if (isNil(neuronLayer) || neuronLayer.type !== ELayerType.Neuron) {
              throw new Error('Unknown model structure');
            }

            const weights = weight.arraySync() as number[];

            weights.forEach((weight, index) => {
              neuronLayer.neurons[index].bias = weight;
            });
          }
        });
      });
    });

    return layers;
  }

  public async mutate(mutationRate?: number): Promise<IRobotPlayer> {
    const newModel = await mutateModel(
      this.model,
      round(mutationRate ?? Math.random() * MAX_MUTATION_RATE, MUTATION_RATE_PRECISION)
    );

    return new TensorflowPlayer(undefined, newModel);
  }

  public async crossoverModels?(secondParent: IRobotPlayer): Promise<IRobotPlayer> {
    try {
      const newModel = await crossoverModels(this.model, (secondParent as TensorflowPlayer).model);

      return new TensorflowPlayer(undefined, newModel);
    } catch {
      return await this.mutate();
    }
  }

  public play(world: IWorld): IAction {
    const {
      pivot,
      bobs: [bob],
    } = world;

    const angleVector = Vector.sub(bob.position, pivot.position);

    const angle = zNormalization(Vector.angle(angleVector, { x: 0, y: 1 }), Math.PI);

    const velocityX = zNormalization(bob.velocity.x, MAX_BOB_VELOCITY);
    const velocityY = zNormalization(bob.velocity.y, MAX_BOB_VELOCITY);

    const position = zNormalization(pivot.position.x, RAILS_HALF_LENGTH);

    const outputValue = tidy(() => {
      const inputTensor = tensor2d([[velocityX, velocityY, angle, position]]);

      const outputTensor = this.model.predict(inputTensor) as Tensor;

      const outputShape = outputTensor.shape;

      if (outputShape.length === 1) {
        return (outputTensor.arraySync() as [number])[0];
      }
      if (outputShape.length === 2) {
        return (outputTensor.arraySync() as [[number]])[0][0];
      }
      throw new Error(`Unsupported shape: ${outputShape}`);
    });

    return { pivotVelocity: outputValue * MAX_PIVOT_VELOCITY };
  }

  public async save(url: string): Promise<void> {
    await this.model.save(url);
  }

  public dispose(): void {
    // Idempotent: a player loaded into `store.currentRobot` is shared between
    // `Playground` instances (e.g. React StrictMode double-mount), so the
    // same tf.js model may be disposed more than once.
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.model.dispose();
  }
}

async function cloneModel(model: LayersModel): Promise<LayersModel> {
  const modelData = await new Promise<ModelArtifacts>(resolve =>
    model.save({
      async save(modelArtifact: ModelArtifacts): Promise<SaveResult> {
        resolve(modelArtifact);

        return {
          modelArtifactsInfo: {
            dateSaved: new Date(),
            modelTopologyType: 'JSON',
          },
        };
      },
    })
  );

  return await loadLayersModel({ load: async () => modelData });
}

async function crossoverModels(father: LayersModel, mother: LayersModel): Promise<LayersModel> {
  const fatherLayers = father.layers;
  const motherLayers = mother.layers;

  if (fatherLayers.length !== motherLayers.length) {
    throw new Error('Layers of parents are not equal');
  }

  const childModel = await cloneModel(father);

  tidy(() =>
    fatherLayers.forEach((layer, index) => {
      const fatherLayerWeights = layer.getWeights();
      const motherLayerWeights2 = motherLayers[index].getWeights();

      if (fatherLayerWeights.length !== motherLayerWeights2.length) {
        childModel.dispose();
        throw new Error('Layers of parents are not equal');
      }

      const childWeights = fatherLayerWeights.map((fatherWeights, weightIndex) => {
        const motherWeights = motherLayerWeights2[weightIndex];

        const shape = fatherWeights.shape;
        const crossoverPoint = Math.trunc(Math.random() * shape[0]);

        const fatherValues = (fatherWeights.arraySync() as number[]).slice(0, crossoverPoint);
        const motherValues = (motherWeights.arraySync() as number[]).slice(crossoverPoint);

        return tensor([...fatherValues, ...motherValues], shape);
      });

      childModel.layers[index].setWeights(childWeights);
    })
  );

  return childModel;
}

async function mutateModel(parent: LayersModel, mutationRate: number): Promise<LayersModel> {
  const mutatedModel = await cloneModel(parent);

  tidy(() =>
    mutatedModel.layers.forEach(layer => {
      if (layer.getWeights().length > 0) {
        const weights = layer.getWeights();

        const mutatedWeights = weights.map(weightTensor => {
          const shape = weightTensor.shape;
          const noise = randomNormal(shape, 0, mutationRate);

          return weightTensor.add(noise);
        });

        layer.setWeights(mutatedWeights);
      }
    })
  );

  return mutatedModel;
}
