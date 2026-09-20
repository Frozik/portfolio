import { round } from 'lodash-es';

import {
  crossoverNetworks,
  IncompatibleNetworkTopologyError,
  mutateNetwork,
} from '../genetic/network-operators';
import type { INetworkSnapshot } from '../neural-network/DenseNetwork';
import { DenseNetwork } from '../neural-network/DenseNetwork';
import { describeNetwork } from '../neural-network/describe-network';
import type { TLayerDescriptor } from '../neural-network/types';
import type { IAction, IRobotPlayer, IWorld } from '../types';
import { EPlayerType } from '../types';
import { observe } from './observation';
import { accelerate } from './pivot-control';
import { acceptsObservation, createPolicyNetwork } from './policy-network';
import { createRobotName } from './robot-name';

const MAX_MUTATION_RATE = 0.2;
const MUTATION_RATE_PRECISION = 4;

export class NetworkPlayer implements IRobotPlayer {
  readonly type = EPlayerType.Robot;
  readonly name: string;

  constructor(
    private readonly network: DenseNetwork = createPolicyNetwork(),
    name: string = createRobotName()
  ) {
    this.name = name;
  }

  static fromSnapshot(name: string, snapshot: INetworkSnapshot): NetworkPlayer {
    const network = DenseNetwork.fromSnapshot(snapshot);

    if (!acceptsObservation(network)) {
      throw new Error(
        `Robot "${name}" was trained on an older observation and cannot drive this cart`
      );
    }

    return new NetworkPlayer(network, name);
  }

  describeNetwork(): readonly TLayerDescriptor[] {
    return describeNetwork(this.network);
  }

  mutate(mutationRate?: number): IRobotPlayer {
    const rate = round(mutationRate ?? Math.random() * MAX_MUTATION_RATE, MUTATION_RATE_PRECISION);

    return new NetworkPlayer(mutateNetwork(this.network, rate));
  }

  crossoverWith(secondParent: IRobotPlayer): IRobotPlayer {
    if (!(secondParent instanceof NetworkPlayer)) {
      return this.mutate();
    }

    try {
      return new NetworkPlayer(crossoverNetworks(this.network, secondParent.network));
    } catch (error) {
      if (error instanceof IncompatibleNetworkTopologyError) {
        return this.mutate();
      }

      throw error;
    }
  }

  play(world: IWorld, deltaTime: DOMHighResTimeStamp): IAction {
    return accelerate(world, this.network.predict(observe(world))[0], deltaTime);
  }

  snapshot(): INetworkSnapshot {
    return this.network.toSnapshot();
  }

  dispose(): void {}
}
