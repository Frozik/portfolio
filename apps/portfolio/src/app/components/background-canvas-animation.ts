import type {
  IAmbientCanvasAnimation,
  IAmbientCanvasFrame,
} from '../../shared/hooks/useAmbientCanvas';

/**
 * App-wide ambient backdrop — two drifting radial gradients (one tracking the
 * pointer), a slowly scrolling grid, and rising particles. Pure animation
 * logic; the React shell lives in `BackgroundCanvas.tsx`.
 */

const PARTICLE_COUNT = 60;
const GRID_SIZE_PX = 80;
const GRID_DRIFT_PX_PER_SEC = 4;
const RADIAL_1_ALPHA = 0.18;
const RADIAL_2_ALPHA = 0.12;
const GRID_ALPHA = 0.035;
const DEFAULT_ACCENT_RGB: readonly [number, number, number] = [96, 165, 250];
const HEX_COLOR_PATTERN = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const HEX_RADIX = 16;
const MOUSE_DEFAULT = { x: 0.5, y: 0.5 };
const CENTER = 0.5;
const RADIAL_1_CENTER_X_BASE = 0.3;
const RADIAL_1_CENTER_X_AMP = 0.15;
const RADIAL_1_MOUSE_X_AMP = 0.1;
const RADIAL_1_CENTER_Y_BASE = 0.4;
const RADIAL_1_CENTER_Y_AMP = 0.2;
const RADIAL_1_FREQ_X = 0.08;
const RADIAL_1_FREQ_Y = 0.07;
const RADIAL_1_SIZE_RATIO = 0.5;
const RADIAL_2_CENTER_X_BASE = 0.75;
const RADIAL_2_CENTER_X_AMP = 0.12;
const RADIAL_2_CENTER_Y_BASE = 0.7;
const RADIAL_2_CENTER_Y_AMP = 0.1;
const RADIAL_2_MOUSE_Y_AMP = 0.1;
const RADIAL_2_FREQ_X = 0.05;
const RADIAL_2_FREQ_Y = 0.06;
const RADIAL_2_SIZE_RATIO = 0.4;
const PARTICLE_VY_MIN = 0.005;
const PARTICLE_VY_SPREAD = 0.015;
const PARTICLE_VX_SPREAD = 0.004;
const PARTICLE_R_MIN = 0.5;
const PARTICLE_R_SPREAD = 1.5;
const PARTICLE_ALPHA_MIN = 0.05;
const PARTICLE_ALPHA_SPREAD = 0.3;
const PARTICLE_DRIFT_SCALE = 0.003;
const PARTICLE_RESPAWN_Y = -0.05;
const PARTICLE_RESPAWN_Y_TOP = 1.05;
const PARTICLE_WRAP_MARGIN = 0.05;
const MS_PER_SECOND = 1000;

interface IParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
}

interface IMousePosition {
  x: number;
  y: number;
}

/**
 * Superset of {@link IAmbientCanvasAnimation} that also accepts normalised
 * (0..1) pointer coordinates, driving the interactive gradient centre. It is
 * assignable to `IAmbientCanvasAnimation` (it has `draw` + `onResize`), so the
 * shell hands it straight to `useAmbientCanvas`.
 */
export interface IBackgroundCanvasAnimation extends IAmbientCanvasAnimation {
  readonly setPointer: (xNorm: number, yNorm: number) => void;
}

function parseAccent(raw: string): readonly [number, number, number] {
  const match = raw.trim().match(HEX_COLOR_PATTERN);
  if (!match) {
    return DEFAULT_ACCENT_RGB;
  }
  return [
    Number.parseInt(match[1], HEX_RADIX),
    Number.parseInt(match[2], HEX_RADIX),
    Number.parseInt(match[3], HEX_RADIX),
  ];
}

function readAccentRgb(): readonly [number, number, number] {
  if (typeof window === 'undefined') {
    return DEFAULT_ACCENT_RGB;
  }
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--color-landing-accent');
  return parseAccent(raw);
}

function createParticles(): IParticle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    x: Math.random(),
    y: Math.random(),
    vy: PARTICLE_VY_MIN + Math.random() * PARTICLE_VY_SPREAD,
    vx: (Math.random() - CENTER) * PARTICLE_VX_SPREAD,
    r: PARTICLE_R_MIN + Math.random() * PARTICLE_R_SPREAD,
    a: PARTICLE_ALPHA_MIN + Math.random() * PARTICLE_ALPHA_SPREAD,
  }));
}

interface IDrawParams {
  readonly context: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
  readonly elapsedSeconds: number;
  readonly accent: readonly [number, number, number];
  readonly mouse: IMousePosition;
  readonly particles: IParticle[];
}

function drawFrame(params: IDrawParams): void {
  const { context, width, height, dpr, elapsedSeconds, accent, mouse, particles } = params;
  const [accentR, accentG, accentB] = accent;

  context.clearRect(0, 0, width, height);

  const cx1 =
    (RADIAL_1_CENTER_X_BASE +
      Math.sin(elapsedSeconds * RADIAL_1_FREQ_X) * RADIAL_1_CENTER_X_AMP +
      (mouse.x - CENTER) * RADIAL_1_MOUSE_X_AMP) *
    width;
  const cy1 =
    (RADIAL_1_CENTER_Y_BASE + Math.cos(elapsedSeconds * RADIAL_1_FREQ_Y) * RADIAL_1_CENTER_Y_AMP) *
    height;
  const r1 = width * RADIAL_1_SIZE_RATIO;
  const g1 = context.createRadialGradient(cx1, cy1, 0, cx1, cy1, r1);
  g1.addColorStop(0, `rgba(${accentR},${accentG},${accentB},${RADIAL_1_ALPHA})`);
  g1.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = g1;
  context.fillRect(0, 0, width, height);

  const cx2 =
    (RADIAL_2_CENTER_X_BASE + Math.sin(elapsedSeconds * RADIAL_2_FREQ_X) * RADIAL_2_CENTER_X_AMP) *
    width;
  const cy2 =
    (RADIAL_2_CENTER_Y_BASE +
      Math.cos(elapsedSeconds * RADIAL_2_FREQ_Y) * RADIAL_2_CENTER_Y_AMP +
      (mouse.y - CENTER) * RADIAL_2_MOUSE_Y_AMP) *
    height;
  const r2 = width * RADIAL_2_SIZE_RATIO;
  const g2 = context.createRadialGradient(cx2, cy2, 0, cx2, cy2, r2);
  g2.addColorStop(0, `rgba(${accentR},${accentG},${accentB},${RADIAL_2_ALPHA})`);
  g2.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = g2;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = `rgba(${accentR},${accentG},${accentB},${GRID_ALPHA})`;
  context.lineWidth = dpr;
  const gridSize = GRID_SIZE_PX * dpr;
  const gridOffset = (-elapsedSeconds * GRID_DRIFT_PX_PER_SEC) % gridSize;
  for (let x = gridOffset; x < width; x += gridSize) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = gridOffset; y < height; y += gridSize) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  for (const particle of particles) {
    particle.y -= particle.vy * PARTICLE_DRIFT_SCALE;
    particle.x += particle.vx * PARTICLE_DRIFT_SCALE;
    if (particle.y < PARTICLE_RESPAWN_Y) {
      particle.y = PARTICLE_RESPAWN_Y_TOP;
      particle.x = Math.random();
    }
    if (particle.x < -PARTICLE_WRAP_MARGIN) {
      particle.x = 1 + PARTICLE_WRAP_MARGIN;
    }
    if (particle.x > 1 + PARTICLE_WRAP_MARGIN) {
      particle.x = -PARTICLE_WRAP_MARGIN;
    }
    const px = particle.x * width;
    const py = particle.y * height;
    context.fillStyle = `rgba(${accentR},${accentG},${accentB},${particle.a})`;
    context.beginPath();
    context.arc(px, py, particle.r * dpr, 0, Math.PI * 2);
    context.fill();
  }
}

export function createBackgroundCanvasAnimation(): IBackgroundCanvasAnimation {
  let particles: IParticle[] = [];
  let accent: readonly [number, number, number] = DEFAULT_ACCENT_RGB;
  const mouse: IMousePosition = { ...MOUSE_DEFAULT };

  return {
    onResize(): void {
      // Particles draw in backing-store pixels (manual `* dpr`), so the context
      // stays at identity. Accent is size-independent but was previously read
      // every frame — cache it here instead. Particles are created once.
      accent = readAccentRgb();
      if (particles.length === 0) {
        particles = createParticles();
      }
    },

    draw(frame: IAmbientCanvasFrame): void {
      drawFrame({
        context: frame.ctx,
        width: frame.cssWidth * frame.dpr,
        height: frame.cssHeight * frame.dpr,
        dpr: frame.dpr,
        elapsedSeconds: frame.elapsedMs / MS_PER_SECOND,
        accent,
        mouse,
        particles,
      });
    },

    setPointer(xNorm: number, yNorm: number): void {
      mouse.x = xNorm;
      mouse.y = yNorm;
    },
  };
}
