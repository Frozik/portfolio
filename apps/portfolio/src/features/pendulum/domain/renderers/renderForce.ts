export function renderForce(context: CanvasRenderingContext2D, { x, y }: { x: number; y: number }) {
  context.save();

  context.beginPath();
  context.arc(x, y, 20, 0, 2 * Math.PI);
  context.lineWidth = 2 + Math.round(Math.random() * 3);
  context.strokeStyle = '#4096ff';
  context.stroke();

  context.restore();
}
