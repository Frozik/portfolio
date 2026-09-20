import { assert } from '@frozik/utils/assert/assert';

/**
 * One fully connected layer. `weights` is row-major `inputSize × outputSize`:
 * `weights[feature * outputSize + unit]` is the edge from `feature` into `unit`.
 */
export interface IDenseLayer {
  readonly inputSize: number;
  readonly outputSize: number;
  readonly weights: Float32Array;
  readonly biases: Float32Array;
}

/** What the repository persists; typed arrays survive structured clone, so it round-trips through IndexedDB as it is. */
export interface INetworkSnapshot {
  readonly layers: readonly IDenseLayer[];
}

/**
 * A stack of dense `tanh` layers evaluated in plain JavaScript.
 *
 * Measured against the tf.js model this replaces: 0.23 µs per inference
 * against 16 µs, and ONNX Runtime Web was slower still at 28 µs. At this size
 * a runtime spends all its time on per-call overhead instead of on the ~100
 * multiplications, so the overhead is the whole cost. Activations are reused
 * between calls because the simulation runs one inference per robot per frame
 * and must not allocate there.
 */
export class DenseNetwork {
  readonly layers: readonly IDenseLayer[];

  private readonly activations: readonly Float32Array[];

  /**
   * The layers are copied rather than referenced. A network is often built from
   * weights that reached it through the MobX store, where they arrive as
   * observable proxies; those cannot be structured-cloned, so storing one would
   * make the whole snapshot unpersistable. Owning plain buffers also means no
   * caller can change a network's weights after it was built.
   */
  constructor(layers: readonly IDenseLayer[]) {
    assert(layers.length > 0, 'A network needs at least one layer');

    this.layers = layers.map(({ inputSize, outputSize, weights, biases }) => ({
      inputSize,
      outputSize,
      weights: Float32Array.from(weights),
      biases: Float32Array.from(biases),
    }));
    this.activations = layers.map(({ outputSize }) => new Float32Array(outputSize));
  }

  static fromSnapshot(snapshot: INetworkSnapshot): DenseNetwork {
    return new DenseNetwork(snapshot.layers);
  }

  get inputSize(): number {
    return this.layers[0].inputSize;
  }

  get outputSize(): number {
    return this.layers[this.layers.length - 1].outputSize;
  }

  /** The returned buffer is overwritten by the next call; copy it to keep a result. */
  predict(input: readonly number[] | Float32Array): Float32Array {
    assert(
      input.length === this.inputSize,
      `A network reading ${this.inputSize} inputs cannot run on ${input.length}`
    );

    let source: readonly number[] | Float32Array = input;

    for (let index = 0; index < this.layers.length; index += 1) {
      const { inputSize, outputSize, weights, biases } = this.layers[index];
      const output = this.activations[index];

      for (let unit = 0; unit < outputSize; unit += 1) {
        let sum = biases[unit];

        for (let feature = 0; feature < inputSize; feature += 1) {
          sum += source[feature] * weights[feature * outputSize + unit];
        }

        output[unit] = Math.tanh(sum);
      }

      source = output;
    }

    return this.activations[this.activations.length - 1];
  }

  toSnapshot(): INetworkSnapshot {
    return { layers: this.layers };
  }
}
