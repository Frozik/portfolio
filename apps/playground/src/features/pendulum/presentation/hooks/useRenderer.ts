import { isNil } from 'lodash-es';
import { useMemo, useState } from 'react';
import { renderForce } from '../../domain/renderers/renderForce';
import { renderPendulum } from '../../domain/renderers/renderPendulum';
import { renderRails } from '../../domain/renderers/renderRails';
import type { IRenderer, IWorld } from '../../domain/types';

export function useRenderer(): [
  IRenderer | undefined,
  setContexts: (contexts: {
    staticContext: CanvasRenderingContext2D;
    context: CanvasRenderingContext2D;
  }) => void,
] {
  const [contexts, setContexts] = useState<
    { staticContext: CanvasRenderingContext2D; context: CanvasRenderingContext2D } | undefined
  >();
  const renderer = useMemo(() => {
    if (isNil(contexts)) {
      return;
    }

    return {
      renderStatic() {
        const {
          staticContext: context,
          staticContext: {
            canvas: { width, height },
          },
        } = contexts;

        context.clearRect(0, 0, width, height);

        context.save();

        context.translate(width >> 1, height >> 1);

        renderRails(context);

        context.restore();
      },
      render(worlds: IWorld[], additionalForcePosition?: { x: number; y: number }) {
        const {
          context,
          context: {
            canvas: { width, height },
          },
        } = contexts;

        context.clearRect(0, 0, width, height);

        context.save();

        context.translate(width >> 1, height >> 1);

        worlds.forEach(world => renderPendulum(context, world));

        if (!isNil(additionalForcePosition)) {
          renderForce(context, additionalForcePosition);
        }

        context.restore();
      },
    };
  }, [contexts]);

  return [renderer, setContexts];
}
