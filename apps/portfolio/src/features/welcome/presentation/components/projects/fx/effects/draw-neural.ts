import type { IFxDrawContext } from '../types';

const LAYER_SIZES = [3, 5, 5, 1] as const;
const PADDING_RATIO = 0.18;
const SIGNAL_SPEED = 0.8;
const SIGNAL_POSITION_PHASE = 0.003;
const EDGE_ALPHA = 0.08;
const EDGE_LINE_WIDTH_PX = 0.8;
const SIGNAL_ALPHA = 0.9;
const SIGNAL_RADIUS_PX = 1.6;
const NODE_PULSE_SPEED = 2;
const NODE_MIN_ALPHA = 0.25;
const NODE_ALPHA_RANGE = 0.4;
const NODE_RADIUS_PX = 3;
const NODE_PULSE_RADIUS_PX = 1.5;
const NODE_RING_ALPHA = 0.9;
const RANDOM_CENTER = 0.5;

interface IPoint {
  readonly x: number;
  readonly y: number;
}

function layoutLayers(width: number, height: number): readonly (readonly IPoint[])[] {
  const paddingX = width * PADDING_RATIO;
  const paddingY = height * PADDING_RATIO;
  const layerSpacing = (width - paddingX * 2) / (LAYER_SIZES.length - 1);
  return LAYER_SIZES.map((count, layerIndex) =>
    Array.from({ length: count }, (_, nodeIndex) => ({
      x: paddingX + layerIndex * layerSpacing,
      y:
        paddingY +
        (height - paddingY * 2) * (count === 1 ? RANDOM_CENTER : nodeIndex / (count - 1)),
    }))
  );
}

/** A small feed-forward network with signals travelling along the edges. */
export function drawNeural({
  ctx,
  width,
  height,
  time,
  accent,
  devicePixelRatio,
}: IFxDrawContext): void {
  const layers = layoutLayers(width, height);

  for (let layerIndex = 0; layerIndex < layers.length - 1; layerIndex++) {
    for (const fromNode of layers[layerIndex] ?? []) {
      for (const toNode of layers[layerIndex + 1] ?? []) {
        const phase = (time * SIGNAL_SPEED + (fromNode.x + fromNode.y) * SIGNAL_POSITION_PHASE) % 1;
        ctx.strokeStyle = accent(EDGE_ALPHA);
        ctx.lineWidth = EDGE_LINE_WIDTH_PX * devicePixelRatio;
        ctx.beginPath();
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(toNode.x, toNode.y);
        ctx.stroke();
        ctx.fillStyle = accent(SIGNAL_ALPHA * (1 - phase));
        ctx.beginPath();
        ctx.arc(
          fromNode.x + (toNode.x - fromNode.x) * phase,
          fromNode.y + (toNode.y - fromNode.y) * phase,
          SIGNAL_RADIUS_PX * devicePixelRatio,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
  }

  layers.flat().forEach((node, nodeIndex) => {
    const pulse = RANDOM_CENTER + RANDOM_CENTER * Math.sin(time * NODE_PULSE_SPEED + nodeIndex);
    ctx.fillStyle = accent(NODE_MIN_ALPHA + pulse * NODE_ALPHA_RANGE);
    ctx.beginPath();
    ctx.arc(
      node.x,
      node.y,
      (NODE_RADIUS_PX + pulse * NODE_PULSE_RADIUS_PX) * devicePixelRatio,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.strokeStyle = accent(NODE_RING_ALPHA);
    ctx.lineWidth = devicePixelRatio;
    ctx.beginPath();
    ctx.arc(node.x, node.y, NODE_RADIUS_PX * devicePixelRatio, 0, Math.PI * 2);
    ctx.stroke();
  });
}
