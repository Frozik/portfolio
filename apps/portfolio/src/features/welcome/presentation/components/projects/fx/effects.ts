/**
 * Canvas draw functions for project-card FX overlays.
 * Ported from `redesign/scripts/project-fx.js`. Each function receives the
 * current draw context and a per-effect mutable state bag for stateful sims
 * (shapes drift, typing progression, …). Drawing functions must not allocate
 * per-frame when avoidable; all tuning numbers are intentionally inline to
 * preserve the visual fidelity of the ported design reference.
 */

import type { IFxDrawContext, TAccentAlpha, TFxDraw } from './types';
import { pseudoRandom } from './utils';

const MONO_FONT_STACK = 'ui-monospace, Menlo, Monaco, Consolas, monospace';

function drawNeural({ ctx, width, height, time, speed, accent, dpr }: IFxDrawContext): void {
  const layers = [3, 5, 5, 1];
  const padX = width * 0.18;
  const padY = height * 0.18;
  const layerWidth = (width - padX * 2) / (layers.length - 1);
  const points: Array<Array<[number, number]>> = layers.map((count, layerIndex) => {
    const x = padX + layerIndex * layerWidth;
    const nodes: Array<[number, number]> = [];
    for (let i = 0; i < count; i++) {
      const y = padY + (height - padY * 2) * (count === 1 ? 0.5 : i / (count - 1));
      nodes.push([x, y]);
    }
    return nodes;
  });

  for (let layerIndex = 0; layerIndex < points.length - 1; layerIndex++) {
    for (const a of points[layerIndex]) {
      for (const b of points[layerIndex + 1]) {
        const phase = (time * speed * 0.8 + (a[0] + a[1]) * 0.003) % 1;
        ctx.strokeStyle = accent(0.08);
        ctx.lineWidth = 0.8 * dpr;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
        const px = a[0] + (b[0] - a[0]) * phase;
        const py = a[1] + (b[1] - a[1]) * phase;
        ctx.fillStyle = accent(0.9 * (1 - phase));
        ctx.beginPath();
        ctx.arc(px, py, 1.6 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const allNodes = points.flat();
  for (let i = 0; i < allNodes.length; i++) {
    const [x, y] = allNodes[i];
    const pulse = 0.5 + 0.5 * Math.sin(time * speed * 2 + i);
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

function drawFlare({ ctx, width, height, time, speed, accent, dpr }: IFxDrawContext): void {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.42;
  const rayCount = 36;

  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2 + time * speed * 0.15;
    const length = radius * (0.95 + 0.1 * Math.sin(time * speed * 2 + i));
    const x1 = cx + Math.cos(angle) * radius * 0.95;
    const y1 = cy + Math.sin(angle) * radius * 0.95;
    const x2 = cx + Math.cos(angle) * length * 1.15;
    const y2 = cy + Math.sin(angle) * length * 1.15;
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, accent(0.5));
    grad.addColorStop(1, accent(0));
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.2 * dpr;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  const sweep = (time * speed * 0.6) % (Math.PI * 2);
  ctx.strokeStyle = accent(0.7);
  ctx.lineWidth = 1.5 * dpr;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.02, sweep, sweep + 0.8);
  ctx.stroke();

  ctx.strokeStyle = accent(0.25);
  ctx.lineWidth = dpr;
  ctx.setLineDash([4 * dpr, 6 * dpr]);
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.08, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

interface IFloatingShape {
  x: number;
  y: number;
  size: number;
  sides: number;
  rotation: number;
  vx: number;
  vy: number;
  vr: number;
  filled: boolean;
}

function drawShapes(
  { ctx, width, height, speed, accent, dpr }: IFxDrawContext,
  state: Record<string, unknown>
): void {
  if (!state.shapes) {
    state.shapes = Array.from({ length: 14 }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: 0.03 + Math.random() * 0.05,
      sides: 3 + Math.floor(Math.random() * 5),
      rotation: Math.random() * Math.PI * 2,
      vx: (Math.random() - 0.5) * 0.08,
      vy: (Math.random() - 0.5) * 0.08,
      vr: (Math.random() - 0.5) * 1.2,
      filled: Math.random() > 0.5,
    })) as IFloatingShape[];
  }

  const shapes = state.shapes as IFloatingShape[];
  const dt = 0.016 * speed;

  for (const shape of shapes) {
    shape.x += shape.vx * dt;
    shape.y += shape.vy * dt;
    shape.rotation += shape.vr * dt;
    if (shape.x < 0 || shape.x > 1) {
      shape.vx *= -1;
    }
    if (shape.y < 0 || shape.y > 1) {
      shape.vy *= -1;
    }
    const cx = shape.x * width;
    const cy = shape.y * height;
    const radius = shape.size * Math.min(width, height);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(shape.rotation);
    ctx.beginPath();
    for (let i = 0; i <= shape.sides; i++) {
      const angle = (i / shape.sides) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    if (shape.filled) {
      ctx.fillStyle = accent(0.35);
      ctx.fill();
    }
    ctx.strokeStyle = accent(0.8);
    ctx.lineWidth = 1.2 * dpr;
    ctx.stroke();
    ctx.restore();
  }
}

function drawCrosshair({ ctx, width, height, time, speed, accent, dpr }: IFxDrawContext): void {
  const candleW = Math.max(5 * dpr, width / 32);
  const gap = Math.max(dpr, candleW * 0.25);
  const pitch = candleW + gap;
  const n = Math.ceil(width / pitch) + 4;
  const scroll = (time * speed * 0.6) % 1;
  const offsetX = -scroll * pitch;
  const startIdx = Math.floor(time * speed * 0.6);
  const vertPad = 18 * dpr;
  const chartTop = vertPad;
  const chartBottom = height - vertPad;
  const chartH = chartBottom - chartTop;

  const series: Array<{ o: number; c: number; hi: number; lo: number; i: number }> = [];
  let price = 100;
  for (let i = startIdx - 50; i <= startIdx + n; i++) {
    const drift = (pseudoRandom(i, 1) - 0.5) * 6;
    const o = price;
    const c = price + drift;
    const hi = Math.max(o, c) + pseudoRandom(i, 2) * 3;
    const lo = Math.min(o, c) - pseudoRandom(i, 3) * 3;
    if (i >= startIdx) {
      series.push({ o, c, hi, lo, i });
    }
    price = c;
  }

  let vmin = Number.POSITIVE_INFINITY;
  let vmax = Number.NEGATIVE_INFINITY;
  for (const candle of series) {
    if (candle.lo < vmin) {
      vmin = candle.lo;
    }
    if (candle.hi > vmax) {
      vmax = candle.hi;
    }
  }
  const vpad = (vmax - vmin) * 0.08;
  vmin -= vpad;
  vmax += vpad;
  const priceToY = (p: number) => chartBottom - ((p - vmin) / (vmax - vmin)) * chartH;

  ctx.strokeStyle = accent(0.06);
  ctx.lineWidth = dpr;
  for (let g = 1; g < 5; g++) {
    const y = chartTop + (chartH * g) / 5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  for (let k = 0; k < series.length; k++) {
    const can = series[k];
    const x = offsetX + k * pitch;
    const xMid = x + candleW / 2;
    const bullish = can.c >= can.o;
    const bodyTop = priceToY(Math.max(can.o, can.c));
    const bodyBot = priceToY(Math.min(can.o, can.c));
    const yHi = priceToY(can.hi);
    const yLo = priceToY(can.lo);
    const color = bullish ? accent(0.85) : accent(0.35);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, dpr);
    ctx.beginPath();
    ctx.moveTo(xMid, yHi);
    ctx.lineTo(xMid, yLo);
    ctx.stroke();
    if (bullish) {
      ctx.fillStyle = color;
      ctx.fillRect(x, bodyTop, candleW, Math.max(dpr, bodyBot - bodyTop));
    } else {
      ctx.fillStyle = accent(0.12);
      ctx.fillRect(x, bodyTop, candleW, Math.max(dpr, bodyBot - bodyTop));
      ctx.strokeStyle = color;
      ctx.strokeRect(x + 0.5, bodyTop + 0.5, candleW - 1, Math.max(dpr, bodyBot - bodyTop) - 1);
    }
  }

  const last = series[series.length - 1];
  if (last) {
    const py = priceToY(last.c);
    ctx.strokeStyle = accent(0.5);
    ctx.lineWidth = dpr;
    ctx.setLineDash([2 * dpr, 3 * dpr]);
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(width, py);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const cx = width * (0.35 + 0.3 * (0.5 + 0.5 * Math.sin(time * speed * 0.6)));
  const cy = height * (0.38 + 0.22 * (0.5 + 0.5 * Math.sin(time * speed * 0.9 + 1)));

  ctx.strokeStyle = accent(0.55);
  ctx.lineWidth = dpr;
  ctx.setLineDash([3 * dpr, 4 * dpr]);
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, height);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(width, cy);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = accent(1);
  ctx.beginPath();
  ctx.arc(cx, cy, 3 * dpr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = accent(0.4);
  ctx.lineWidth = dpr;
  ctx.beginPath();
  ctx.arc(cx, cy, 8 * dpr, 0, Math.PI * 2);
  ctx.stroke();
}

function drawTicker({ ctx, width, height, time, speed, accent, dpr }: IFxDrawContext): void {
  const axisW = 48 * dpr;
  const gridW = width - axisW;
  const gridH = height;
  const rows = 28;
  const cellH = gridH / rows;
  const colW = Math.max(4 * dpr, gridW / 60);
  const cols = Math.ceil(gridW / colW) + 2;

  const midRaw =
    rows / 2 + Math.sin(time * speed * 0.18) * 4 + Math.sin(time * speed * 0.07 + 1.2) * 2.5;

  const midY = (col: number) => {
    const localT = time - col * (colW / (gridW * speed * 0.5 + 1)) * 0.15;
    return (
      rows / 2 + Math.sin(localT * speed * 0.18) * 4 + Math.sin(localT * speed * 0.07 + 1.2) * 2.5
    );
  };

  const scroll = (time * speed * 0.8) % 1;
  const offsetX = -scroll * colW;

  ctx.fillStyle = 'rgba(7,9,12,0.4)';
  ctx.fillRect(0, 0, gridW, gridH);

  const colIdx0 = Math.floor(time * speed * 0.8);
  for (let c = 0; c < cols; c++) {
    const colAbs = colIdx0 + c;
    const x = offsetX + c * colW;
    const midAtCol = midY(c);

    for (let r = 0; r < rows; r++) {
      const dist = r - midAtCol;
      const absD = Math.abs(dist);
      let base = Math.exp(-((absD / 4.2) ** 2)) * 0.6;
      const noise = pseudoRandom(colAbs * 0.3, r);
      base += noise * noise * 0.5 * Math.max(0, 1 - absD / 12);
      const wallSeed = r + Math.floor((colAbs / 35) % 999);
      if (pseudoRandom(wallSeed, r * 0.11) > 0.82) {
        base += 0.55 * Math.max(0, 1 - absD / 10);
      }
      if (base < 0.03) {
        continue;
      }
      const intensity = Math.min(1, base);
      const isBid = r > midAtCol;
      const y = r * cellH;
      ctx.fillStyle = isBid ? accent(intensity * 0.9) : accent(intensity * 0.45);
      ctx.fillRect(x, y, colW + 0.5, cellH + 0.5);
    }
  }

  const midLineY = midRaw * cellH + cellH / 2;
  ctx.strokeStyle = accent(0.9);
  ctx.lineWidth = 1.4 * dpr;
  ctx.setLineDash([4 * dpr, 3 * dpr]);
  ctx.beginPath();
  const samples = 40;
  ctx.moveTo(0, midY(cols - 1) * cellH + cellH / 2);
  for (let s = 1; s <= samples; s++) {
    const p = s / samples;
    const col = (cols - 1) * (1 - p);
    const x = p * gridW;
    const my = midY(col) * cellH + cellH / 2;
    ctx.lineTo(x, my);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = `${9 * dpr}px ${MONO_FONT_STACK}`;
  ctx.fillStyle = accent(0.35);
  ctx.textAlign = 'left';
  const basePrice = 67892.5;
  const step = 2.5;
  for (let r = 2; r < rows; r += 4) {
    const y = r * cellH + cellH / 2;
    const p = basePrice + (rows / 2 - r) * step;
    ctx.fillText(p.toFixed(1), gridW + 4 * dpr, y + 3 * dpr);
  }

  const price = (basePrice + (rows / 2 - midRaw) * step).toFixed(2);
  const priceWidth = ctx.measureText(price).width + 10 * dpr;
  ctx.fillStyle = accent(1);
  ctx.fillRect(gridW + 2 * dpr, midLineY - 8 * dpr, priceWidth, 16 * dpr);
  ctx.fillStyle = '#07090c';
  ctx.fillText(price, gridW + 7 * dpr, midLineY + 3.5 * dpr);

  ctx.fillStyle = accent(0.6);
  ctx.fillText('BTC/USDT · DEPTH', 8 * dpr, 14 * dpr);
  if (Math.floor(time * 3) % 2 === 0) {
    ctx.fillStyle = accent(0.95);
    ctx.beginPath();
    ctx.arc(10 * dpr, height - 10 * dpr, 2.5 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = accent(0.65);
  ctx.fillText('LIVE · WSS', 18 * dpr, height - 7 * dpr);
}

const SUDOKU_BOARD = [
  '53..7....',
  '6..195...',
  '.98....6.',
  '8...6...3',
  '4..8.3..1',
  '7...2...6',
  '.6....28.',
  '...419..5',
  '....8..79',
] as const;

function drawCursor({ ctx, width, height, time, speed, accent, dpr }: IFxDrawContext): void {
  const size = 9;
  const cellW = width / size;
  const cellH = height / size;

  const empties: Array<[number, number]> = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (SUDOKU_BOARD[r][c] === '.') {
        empties.push([r, c]);
      }
    }
  }
  if (empties.length === 0) {
    return;
  }
  const idx = Math.floor(time * speed * 0.6) % empties.length;
  const [curR, curC] = empties[idx];
  const boxR = Math.floor(curR / 3) * 3;
  const boxC = Math.floor(curC / 3) * 3;
  const guess = '123456789'[idx % 9];

  ctx.fillStyle = accent(0.05);
  ctx.fillRect(0, curR * cellH, width, cellH);
  ctx.fillRect(curC * cellW, 0, cellW, height);
  ctx.fillStyle = accent(0.07);
  ctx.fillRect(boxC * cellW, boxR * cellH, cellW * 3, cellH * 3);

  ctx.fillStyle = accent(0.14);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (SUDOKU_BOARD[r][c] === guess) {
        ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
      }
    }
  }

  ctx.fillStyle = accent(0.28);
  ctx.fillRect(curC * cellW, curR * cellH, cellW, cellH);

  ctx.strokeStyle = accent(0.15);
  ctx.lineWidth = dpr;
  ctx.beginPath();
  for (let i = 1; i < size; i++) {
    if (i % 3 === 0) {
      continue;
    }
    const x = i * cellW;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    const y = i * cellH;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  ctx.strokeStyle = accent(0.5);
  ctx.lineWidth = 1.5 * dpr;
  ctx.beginPath();
  for (let i = 0; i <= size; i += 3) {
    const x = i * cellW;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    const y = i * cellH;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  const fontSize = Math.min(cellW, cellH) * 0.58;
  ctx.font = `${fontSize}px ${MONO_FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const ch = SUDOKU_BOARD[r][c];
      if (ch === '.') {
        continue;
      }
      const same = ch === guess;
      ctx.fillStyle = same ? accent(1) : accent(0.55);
      ctx.fillText(ch, c * cellW + cellW / 2, r * cellH + cellH / 2 + dpr);
    }
  }

  if (Math.floor(time * 3) % 2 === 0) {
    ctx.fillStyle = accent(1);
    ctx.fillText(guess, curC * cellW + cellW / 2, curR * cellH + cellH / 2 + dpr);
  }

  ctx.strokeStyle = accent(1);
  ctx.lineWidth = 2 * dpr;
  ctx.strokeRect(curC * cellW + dpr, curR * cellH + dpr, cellW - 2 * dpr, cellH - 2 * dpr);

  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

function drawRotate({ ctx, width, height, time, speed, accent, dpr }: IFxDrawContext): void {
  const cx = width / 2;
  const cy = height * 0.55;
  const scale = Math.min(width, height) * 0.3;
  const baseRadius = 1;
  const apexHeight = 1.55;

  const base3: Array<[number, number, number]> = [];
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
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

function drawPeers({ ctx, width, height, time, speed, accent, dpr }: IFxDrawContext): void {
  const peerCount = 5;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.32;
  const points: Array<[number, number]> = [];
  for (let i = 0; i < peerCount; i++) {
    const angle = (i / peerCount) * Math.PI * 2 + time * speed * 0.1;
    points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }

  ctx.strokeStyle = accent(0.15);
  ctx.lineWidth = dpr;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      ctx.beginPath();
      ctx.moveTo(points[i][0], points[i][1]);
      ctx.lineTo(points[j][0], points[j][1]);
      ctx.stroke();
      const phase = (time * speed * 0.6 + (i * 0.2 + j * 0.13)) % 1;
      const px = points[i][0] + (points[j][0] - points[i][0]) * phase;
      const py = points[i][1] + (points[j][1] - points[i][1]) * phase;
      ctx.fillStyle = accent(0.9);
      ctx.beginPath();
      ctx.arc(px, py, 2 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i];
    ctx.fillStyle = accent(0.2);
    ctx.beginPath();
    ctx.arc(x, y, 12 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = accent(1);
    ctx.beginPath();
    ctx.arc(x, y, 7 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#07090c';
    ctx.font = `${8 * dpr}px ${MONO_FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`P${i + 1}`, x, y);
  }
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

interface ITypingState {
  phrase: string;
  shown: number;
  last: number;
}

function drawTyping(
  { ctx, width, height, time, speed, accent, dpr }: IFxDrawContext,
  state: Record<string, unknown>
): void {
  if (!state.typing) {
    state.typing = { phrase: 'next fri 9am', shown: 0, last: 0 } satisfies ITypingState;
  }
  const typing = state.typing as ITypingState;
  if (time - typing.last > 0.15 / speed) {
    typing.last = time;
    typing.shown = (typing.shown + 1) % (typing.phrase.length + 15);
  }
  const shown = typing.phrase.slice(0, Math.min(typing.shown, typing.phrase.length));
  const x = width * 0.08;
  const y = height * 0.55;
  ctx.strokeStyle = accent(0.4);
  ctx.lineWidth = dpr;
  ctx.strokeRect(x - 10 * dpr, y - 14 * dpr, width - x * 2 + 20 * dpr, 28 * dpr);
  ctx.font = `${14 * dpr}px ${MONO_FONT_STACK}`;
  ctx.fillStyle = accent(1);
  ctx.fillText(shown, x, y);
  const caretX = x + ctx.measureText(shown).width + dpr;
  if (Math.floor(time * 2.5) % 2 === 0) {
    ctx.fillRect(caretX, y - 11 * dpr, 1.5 * dpr, 14 * dpr);
  }
}

function drawAR({ ctx, width, height, time, speed, accent, dpr }: IFxDrawContext): void {
  const cx = width / 2;
  const cy = height * 0.54;
  const faceW = Math.min(width, height) * 0.44;
  const faceH = faceW * 1.3;

  const baseGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.7);
  baseGrad.addColorStop(0, accent(0.06));
  baseGrad.addColorStop(1, accent(0));
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.strokeStyle = accent(0.18);
  ctx.lineWidth = dpr;
  ctx.setLineDash([3 * dpr, 4 * dpr]);
  ctx.beginPath();
  ctx.ellipse(cx, cy + faceH * 0.02, faceW / 2, faceH / 2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const bx = cx - faceW / 2 - 10 * dpr;
  const by = cy - faceH / 2 - 10 * dpr;
  const bw = faceW + 20 * dpr;
  const bhh = faceH + 20 * dpr;
  const cornerLen = 18 * dpr;
  const cornerPulse = 0.55 + 0.45 * Math.sin(time * speed * 2);

  ctx.strokeStyle = accent(0.55);
  ctx.lineWidth = 1.5 * dpr;
  ctx.globalAlpha = 0.55 + cornerPulse * 0.45;
  const corners: Array<[number, number, number, number]> = [
    [bx, by, 1, 1],
    [bx + bw, by, -1, 1],
    [bx, by + bhh, 1, -1],
    [bx + bw, by + bhh, -1, -1],
  ];
  for (const [x, y, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x, y + cornerLen * sy);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cornerLen * sx, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const eyeY = cy - faceH * 0.12;
  const eyeDx = faceW * 0.2;
  const leftEye = { x: cx - eyeDx, y: eyeY };
  const rightEye = { x: cx + eyeDx, y: eyeY };

  const lensW = faceW * 0.3;
  const lensH = faceH * 0.14;

  for (const eye of [leftEye, rightEye]) {
    const grad = ctx.createRadialGradient(eye.x, eye.y, 0, eye.x, eye.y, lensW * 0.9);
    grad.addColorStop(0, accent(0.32));
    grad.addColorStop(1, accent(0));
    ctx.fillStyle = grad;
    ctx.fillRect(eye.x - lensW, eye.y - lensH, lensW * 2, lensH * 2);
  }

  ctx.strokeStyle = accent(0.98);
  ctx.lineWidth = 1.8 * dpr;
  for (const eye of [leftEye, rightEye]) {
    ctx.strokeRect(eye.x - lensW / 2, eye.y - lensH / 2, lensW, lensH);
  }

  ctx.beginPath();
  ctx.moveTo(leftEye.x + lensW / 2, eyeY);
  ctx.lineTo(rightEye.x - lensW / 2, eyeY);
  ctx.moveTo(leftEye.x - lensW / 2, eyeY);
  ctx.lineTo(leftEye.x - lensW / 2 - faceW * 0.18, eyeY - lensH * 0.2);
  ctx.moveTo(rightEye.x + lensW / 2, eyeY);
  ctx.lineTo(rightEye.x + lensW / 2 + faceW * 0.18, eyeY - lensH * 0.2);
  ctx.stroke();

  const scanLineY = by + ((time * speed * 45) % (bhh + 20));
  if (scanLineY < by + bhh) {
    const scanGrad = ctx.createLinearGradient(bx, scanLineY, bx + bw, scanLineY);
    scanGrad.addColorStop(0, accent(0));
    scanGrad.addColorStop(0.5, accent(0.8));
    scanGrad.addColorStop(1, accent(0));
    ctx.fillStyle = scanGrad;
    ctx.fillRect(bx, scanLineY - dpr, bw, 2 * dpr);
  }

  ctx.fillStyle = accent(0.75);
  ctx.font = `${9 * dpr}px ${MONO_FONT_STACK}`;
  ctx.textAlign = 'left';
  ctx.fillText('AR · LIVE', 10 * dpr, height - 10 * dpr);
}

const DRAW_FUNCTIONS: Record<string, TFxDraw> = {
  neural: drawNeural,
  flare: drawFlare,
  shapes: drawShapes,
  crosshair: drawCrosshair,
  ticker: drawTicker,
  cursor: drawCursor,
  rotate: drawRotate,
  peers: drawPeers,
  typing: drawTyping,
  ar: drawAR,
};

export function getFxDraw(kind: string): TFxDraw {
  return DRAW_FUNCTIONS[kind] ?? drawNeural;
}

export function buildAccentFn(rgb: readonly [number, number, number]): TAccentAlpha {
  return (alpha: number) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}
