import type { LayersModel, Tensor } from '@tensorflow/tfjs';
import { loadLayersModel, tensor2d, tidy } from '@tensorflow/tfjs';
import { round } from 'lodash-es';
import { Vector } from 'matter-js';

import { RAILS_HALF_LENGTH } from '../constants';
import {
  crossoverModels,
  IncompatibleModelTopologyError,
  mutateModel,
} from '../genetic/model-operators';
import { describeModel } from '../neural-network/describe-model';
import type { TLayerDescriptor } from '../neural-network/types';
import type { IAction, IRobotPlayer, IWorld, RobotModelUrl } from '../types';
import { EPlayerType } from '../types';
import { zNormalization } from '../utils';
import { createRobotName } from './robot-name';
import { createInitialModel, ensureTensorflowBackend } from './tensorflow-model';

const MAX_PIVOT_VELOCITY = 1;
const MAX_BOB_VELOCITY = 50;
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
    return new TensorflowPlayer(await loadLayersModel(modelUrl), name);
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

  play(world: IWorld): IAction {
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
      const outputTensor = this.model.predict(
        tensor2d([[velocityX, velocityY, angle, position]])
      ) as Tensor;

      return (outputTensor.arraySync() as number[][])[0][0];
    });

    return { pivotVelocity: outputValue * MAX_PIVOT_VELOCITY };
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
