/** Ported design reference — tuning numbers are intentionally inline (see `../effect-registry`). */

import type { IFxDrawContext } from '../types';

export function drawNeural({ ctx, width, height, time, speed, accent, dpr }: IFxDrawContext): void {
  const layers = [3, 5, 5, 1];
  const padX = width * 0.18;
  const padY = height * 0.18;
  const layerWidth = (width - padX * 2) / (layers.length - 1);
  const points: Array<Array<[number, number]>> = layers.map((count, layerIndex) => {
    const x = padX + layerIndex * layerWidth;
    const nodes: Array<[number, number]> = [];
    for (let nodeIndex = 0; nodeIndex < count; nodeIndex++) {
      const y = padY + (height - padY * 2) * (count === 1 ? 0.5 : nodeIndex / (count - 1));
      nodes.push([x, y]);
    }
    return nodes;
  });

  for (let layerIndex = 0; layerIndex < points.length - 1; layerIndex++) {
    for (const fromNode of points[layerIndex]) {
      for (const toNode of points[layerIndex + 1]) {
        const phase = (time * speed * 0.8 + (fromNode[0] + fromNode[1]) * 0.003) % 1;
        ctx.strokeStyle = accent(0.08);
        ctx.lineWidth = 0.8 * dpr;
        ctx.beginPath();
        ctx.moveTo(fromNode[0], fromNode[1]);
        ctx.lineTo(toNode[0], toNode[1]);
        ctx.stroke();
        const particleX = fromNode[0] + (toNode[0] - fromNode[0]) * phase;
        const particleY = fromNode[1] + (toNode[1] - fromNode[1]) * phase;
        ctx.fillStyle = accent(0.9 * (1 - phase));
        ctx.beginPath();
        ctx.arc(particleX, particleY, 1.6 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const allNodes = points.flat();
  for (let nodeIndex = 0; nodeIndex < allNodes.length; nodeIndex++) {
    const [x, y] = allNodes[nodeIndex];
    const pulse = 0.5 + 0.5 * Math.sin(time * speed * 2 + nodeIndex);
    ctx.fillStyle = accent(0.25 + pulse * 0.4);
    ctx.beginPath();
    ctx.arc(x, y, (3 + pulse * 1.5) * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = accent(0.9);
    ctx.lineWidth = dpr;
    ctx.beginPath();
    ctx.arc(x, y, 3 * dpr, 0, Math.PI * 2);
    ctx.stroke();
  }
}
