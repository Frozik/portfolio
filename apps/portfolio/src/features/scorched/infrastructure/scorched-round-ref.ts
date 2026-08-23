import type { ScorchedRound } from '../domain/round';

const FIRST_VERSION = 1;

/**
 * A stable handle in front of a swappable round. Starting a new round throws the old
 * `ScorchedRound` away, but the GPU device, textures and layers must outlive it — they hold this
 * reference instead of the round itself, so a rematch never tears the renderer down.
 *
 * `version` is what tells the terrain texture that the field underneath it was replaced and has
 * to be uploaded again from scratch.
 */
export class ScorchedRoundRef {
  private roundValue: ScorchedRound;
  private versionValue = FIRST_VERSION;

  constructor(round: ScorchedRound) {
    this.roundValue = round;
  }

  get current(): ScorchedRound {
    return this.roundValue;
  }

  get version(): number {
    return this.versionValue;
  }

  replace(round: ScorchedRound): void {
    this.roundValue = round;
    this.versionValue++;
  }
}
