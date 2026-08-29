/** Ported design reference — tuning numbers are intentionally inline (see `../effect-registry`). */

import type { IFxDrawContext } from '../types';

export function drawRotate({ ctx, width, height, time, speed, accent, dpr }: IFxDrawContext): void {
  const cx = width / 2;
  const cy = height * 0.55;
  const scale = Math.min(width, height) * 0.3;
  const baseRadius = 1;
  const apexHeight = 1.55;

  const base3: Array<[number, number, number]> = [];
  for (let vertexIndex = 0; vertexIndex < 5; vertexIndex++) {
    const angle = (vertexIndex / 5) * Math.PI * 2 - Math.PI / 2;
    base3.push([Math.cos(angle) * baseRadius, 0, Math.sin(angle) * baseRadius]);
  }
  const apex3: [number, number, number] = [0, -apexHeight, 0];

  const spin = time * speed * 0.35;
  const tiltX = -0.38;
  const sinY = Math.sin(spin);
  const cosY = Math.cos(spin);
  const sinX = Math.sin(tiltX);
  const cosX = Math.cos(tiltX);

  const rotate = (v: [number, number, number]): [number, number, number] => {
    const [x, y, z] = v;
    const x1 = x * cosY + z * sinY;
    const z1 = -x * sinY + z * cosY;
    const y2 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;
    return [x1, y2, z2];
  };

  const camZ = 4;
  const project = (v: [number, number, number]) => {
    const [x, y, z] = rotate(v);
    const k = camZ / (camZ - z);
    return { x: cx + x * scale * k, y: cy + y * scale * k, depth: z };
  };

  const base2 = base3.map(project);
  const apex2 = project(apex3);

  ctx.strokeStyle = accent(0.12);
  ctx.lineWidth = dpr;
  ctx.beginPath();
  ctx.moveTo(0, cy + scale * 0.55);
  ctx.lineTo(width, cy + scale * 0.55);
  ctx.stroke();

  const drawEdge = (aIdx: number | 'apex', bIdx: number | 'apex') => {
    const a = aIdx === 'apex' ? apex2 : base2[aIdx];
    const b = bIdx === 'apex' ? apex2 : base2[bIdx];
    const aB = aIdx === 'apex' ? apex3 : base3[aIdx];
    const bB = bIdx === 'apex' ? apex3 : base3[bIdx];
    const mid: [number, number, number] = [
      (aB[0] + bB[0]) / 2,
      (aB[1] + bB[1]) / 2,
      (aB[2] + bB[2]) / 2,
    ];
    const hidden = rotate(mid)[2] < 0;
    ctx.save();
    ctx.lineWidth = 1.4 * dpr;
    if (hidden) {
      ctx.strokeStyle = accent(0.28);
      ctx.setLineDash([3 * dpr, 4 * dpr]);
    } else {
      ctx.strokeStyle = accent(0.9);
      ctx.setLineDash([]);
    }
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  };

  for (let i = 0; i < 5; i++) {
    drawEdge(i, (i + 1) % 5);
  }
  for (let i = 0; i < 5; i++) {
    drawEdge(i, 'apex');
  }

  const aVert3 = base3[0];
  const mEdgeA = base3[2];
  const mEdgeB = base3[3];
  const mMid3: [number, number, number] = [
    (mEdgeA[0] + mEdgeB[0]) / 2,
    0,
    (mEdgeA[2] + mEdgeB[2]) / 2,
  ];
  const aVert2 = project(aVert3);
  const mMid2 = project(mMid3);

  const m1 = project([
    (base3[1][0] + apex3[0]) / 2,
    (base3[1][1] + apex3[1]) / 2,
    (base3[1][2] + apex3[2]) / 2,
  ]);
  const m2 = project([
    (base3[4][0] + apex3[0]) / 2,
    (base3[4][1] + apex3[1]) / 2,
    (base3[4][2] + apex3[2]) / 2,
  ]);

  const pulse = (time * speed * 0.3) % 1;
  const draw01 = Math.min(1, pulse * 1.4);

  const drawProgressive = (
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    progress: number,
    color: string,
    dash?: readonly number[]
  ) => {
    const ex = p1.x + (p2.x - p1.x) * progress;
    const ey = p1.y + (p2.y - p1.y) * progress;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6 * dpr;
    if (dash) {
      ctx.setLineDash([...dash]);
    }
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.restore();
    return { x: ex, y: ey };
  };

  const endAM = drawProgressive(aVert2, mMid2, draw01, accent(1));
  const endM1M2 = drawProgressive(m1, m2, draw01, accent(0.75), [5 * dpr, 4 * dpr]);

  ctx.fillStyle = accent(1);
  ctx.beginPath();
  ctx.arc(endAM.x, endAM.y, 2.5 * dpr, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(endM1M2.x, endM1M2.y, 2.2 * dpr, 0, Math.PI * 2);
  ctx.fill();

  const vertices = [...base2, apex2];
  for (const v of vertices) {
    ctx.fillStyle = accent(0.95);
    ctx.beginPath();
    ctx.arc(v.x, v.y, 2.8 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }
}
