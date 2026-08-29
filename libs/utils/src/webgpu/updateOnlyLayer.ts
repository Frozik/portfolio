import type { FrameState, RenderLayer } from './renderLayer';

/**
 * A layer that only prepares state for the layers behind it — typically the per-frame uniform
 * write — and draws nothing itself. It keeps its place in the layer list so the ordering stays
 * explicit, while the manager's `init`/`render`/`dispose` calls fall through.
 */
export function createUpdateOnlyLayer(update: (state: FrameState) => void): RenderLayer {
  return {
    init(): void {},
    update,
    render(): void {},
    dispose(): void {},
  };
}
