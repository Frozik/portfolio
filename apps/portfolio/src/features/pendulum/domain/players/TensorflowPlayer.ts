import type { LayersModel, Tensor } from '@tensorflow/tfjs';
import { loadLayersModel, tensor2d, tidy } from '@tensorflow/tfjs';
import { round } from 'lodash-es';

import {
  crossoverModels,
  IncompatibleModelTopologyError,
  mutateModel,
} from '../genetic/model-operators';
import { describeModel } from '../neural-network/describe-model';
import type { TLayerDescriptor } from '../neural-network/types';
import type { IAction, IRobotPlayer, IWorld, RobotModelUrl } from '../types';
import { EPlayerType } from '../types';
import { observe } from './observation';
import { accelerate } from './pivot-control';
import { createRobotName } from './robot-name';
import {
  acceptsObservation,
  createInitialModel,
  ensureTensorflowBackend,
} from './tensorflow-model';

const MAX_MUTATION_RATE = 0.2;
const MUTATION_RATE_PRECISION = 4;

export class TensorflowPlayer implements IRobotPlayer {
  private disposed = false;

  readonly type = EPlayerType.Robot;
  readonly name: string;

  constructor(
    private readonly model: LayersModel = createInitialModel(),
    name: string = createRobotName()
  ) {
    this.name = name;
  }

  static async load(name: string, modelUrl: RobotModelUrl): Promise<TensorflowPlayer> {
    await ensureTensorflowBackend();
    const model = await loadLayersModel(modelUrl);

    if (!acceptsObservation(model)) {
      model.dispose();
      throw new Error(
        `Robot "${name}" was trained on an older observation and cannot drive this cart`
      );
    }

    return new TensorflowPlayer(model, name);
  }

  describeNetwork(): readonly TLayerDescriptor[] {
    return describeModel(this.model);
  }

  async mutate(mutationRate?: number): Promise<IRobotPlayer> {
    const rate = round(mutationRate ?? Math.random() * MAX_MUTATION_RATE, MUTATION_RATE_PRECISION);
    return new TensorflowPlayer(await mutateModel(this.model, rate));
  }

  async crossoverModels(secondParent: IRobotPlayer): Promise<IRobotPlayer> {
    if (!(secondParent instanceof TensorflowPlayer)) {
      return await this.mutate();
    }

    try {
      return new TensorflowPlayer(await crossoverModels(this.model, secondParent.model));
    } catch (error) {
      if (error instanceof IncompatibleModelTopologyError) {
        return await this.mutate();
      }
      throw error;
    }
  }

  play(world: IWorld, deltaTime: DOMHighResTimeStamp): IAction {
    const command = tidy(() => {
      const outputTensor = this.model.predict(tensor2d([[...observe(world)]])) as Tensor;

      return (outputTensor.arraySync() as number[][])[0][0];
    });

    return accelerate(world, command, deltaTime);
  }

  async save(modelUrl: RobotModelUrl): Promise<void> {
    await this.model.save(modelUrl);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.model.dispose();
  }
}
