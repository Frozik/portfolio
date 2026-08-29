import type { LayersModel, Tensor } from '@tensorflow/tfjs';
import {
  io,
  layers,
  loadLayersModel,
  randomNormal,
  sequential,
  setBackend,
  tensor,
  tensor2d,
  tidy,
} from '@tensorflow/tfjs';
import { isEqual, isNil, round } from 'lodash-es';
import { Vector } from 'matter-js';

import { RAILS_HALF_LENGTH } from '../constants';
import type { IAction, IRobotPlayer, IWorld } from '../types';
import { EPlayerType } from '../types';
import { zNormalization } from '../utils';
import type { TLayerDescriptor } from './types';
import { ELayerType, ENeuronLayerType } from './types';

const TF_BACKEND = 'cpu';

// Memoized so the backend switch is awaited exactly once before the first model
// is built. The previous top-level `setBackend('cpu')` was a floating promise:
// a synchronous `new TensorflowPlayer()` could run model ops before the backend
// resolved, and a rejection went unhandled. Entry points that build models
// (`createTensorflowPlayers`, `load`) await this first.
let backendReady: Promise<void> | undefined;

export function ensureTensorflowBackend(): Promise<void> {
  backendReady ??= setBackend(TF_BACKEND).then(() => undefined);
  return backendReady;
}

export const MAX_PIVOT_VELOCITY = 1;

const MAX_BOB_VELOCITY = 50;
const MAX_MUTATION_RATE = 0.2;
const MUTATION_RATE_PRECISION = 4;

/**
 * Signals that two parents cannot be crossed over because their networks do not
 * line up. Breeding treats it as an expected outcome (fall back to a mutation);
 * every other failure stays fatal.
 */
class IncompatibleModelTopologyError extends Error {}

export class TensorflowPlayer implements IRobotPlayer {
  private readonly model: LayersModel;
  private disposed = false;

  readonly type = EPlayerType.Robot;
  readonly name: string;

  constructor(name?: string, model?: LayersModel) {
    this.model = model ?? this.init();
    this.name = name ?? crypto.randomUUID();
  }

  static async load(name: string, url: string): Promise<TensorflowPlayer> {
    await ensureTensorflowBackend();
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
              leftNeuronIds ?? new Array(leftSize).fill(0).map(() => crypto.randomUUID());
            const rightNeuronIds = new Array(rightSize).fill(0).map(() => crypto.randomUUID());

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
                  id: crypto.randomUUID(),
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

  public async crossoverModels(secondParent: IRobotPlayer): Promise<IRobotPlayer> {
    if (!(secondParent instanceof TensorflowPlayer)) {
      return await this.mutate();
    }

    try {
      const newModel = await crossoverModels(this.model, secondParent.model);

      return new TensorflowPlayer(undefined, newModel);
    } catch (error) {
      if (error instanceof IncompatibleModelTopologyError) {
        return await this.mutate();
      }

      throw error;
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
  const modelData = await new Promise<io.ModelArtifacts>(resolve =>
    model.save({
      async save(modelArtifact: io.ModelArtifacts): Promise<io.SaveResult> {
        resolve(modelArtifact);

        return {
          modelArtifactsInfo: io.getModelArtifactsInfoForJSON(modelArtifact),
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
    throw new IncompatibleModelTopologyError('Parents have a different number of layers');
  }

  const childModel = await cloneModel(father);

  try {
    tidy(() =>
      fatherLayers.forEach((layer, index) => {
        const fatherLayerWeights = layer.getWeights();
        const motherLayerWeights = motherLayers[index].getWeights();

        if (fatherLayerWeights.length !== motherLayerWeights.length) {
          throw new IncompatibleModelTopologyError(
            'Parent layers have a different number of weight tensors'
          );
        }

        const childWeights = fatherLayerWeights.map((fatherWeights, weightIndex) => {
          const motherWeights = motherLayerWeights[weightIndex];

          const shape = fatherWeights.shape;

          // Shapes are compared up front so a topology mismatch surfaces as
          // `IncompatibleModelTopologyError` (a breeding fallback) instead of an
          // opaque tf.js `setWeights` failure, which is indistinguishable from a
          // genuine runtime fault.
          if (!isEqual(shape, motherWeights.shape)) {
            throw new IncompatibleModelTopologyError('Parent weight tensors have different shapes');
          }

          const crossoverPoint = Math.trunc(Math.random() * shape[0]);

          const fatherValues = (fatherWeights.arraySync() as number[]).slice(0, crossoverPoint);
          const motherValues = (motherWeights.arraySync() as number[]).slice(crossoverPoint);

          return tensor([...fatherValues, ...motherValues], shape);
        });

        childModel.layers[index].setWeights(childWeights);
      })
    );
  } catch (error) {
    childModel.dispose();

    throw error;
  }

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
