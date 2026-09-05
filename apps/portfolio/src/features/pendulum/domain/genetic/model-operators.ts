import type { LayersModel } from '@tensorflow/tfjs';
import { io, loadLayersModel, randomNormal, tensor, tidy } from '@tensorflow/tfjs';
import { isEqual } from 'lodash-es';

/**
 * Signals that two parents cannot be crossed over because their networks do not
 * line up. Breeding treats it as an expected outcome (fall back to a mutation);
 * every other failure stays fatal.
 */
export class IncompatibleModelTopologyError extends Error {}

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

export async function crossoverModels(
  father: LayersModel,
  mother: LayersModel
): Promise<LayersModel> {
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

export async function mutateModel(parent: LayersModel, mutationRate: number): Promise<LayersModel> {
  const mutatedModel = await cloneModel(parent);

  tidy(() =>
    mutatedModel.layers.forEach(layer => {
      const weights = layer.getWeights();
      if (weights.length === 0) {
        return;
      }

      layer.setWeights(
        weights.map(weightTensor =>
          weightTensor.add(randomNormal(weightTensor.shape, 0, mutationRate))
        )
      );
    })
  );

  return mutatedModel;
}
