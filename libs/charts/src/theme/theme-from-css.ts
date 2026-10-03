import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

import type { IChartTheme } from '../core/frame/theme';
import type { TColor } from '../core/series/color';
import { rgba } from '../core/series/color';

const CHANNEL_MAX = 255;

/** Any CSS colour as the browser resolves it: painted on a pixel and read back, so every syntax works. */
function createColorReader(): (css: string) => TColor | undefined {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  assert(!isNil(context), 'the canvas gave no 2D context');

  return css => {
    if (!CSS.supports('color', css)) {
      return undefined;
    }
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = css;
    context.fillRect(0, 0, 1, 1);
    const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
    if (alpha === 0) {
      return rgba(0, 0, 0, 0);
    }
    // The pixel is read back premultiplied-then-divided; at full alpha it is exact.
    return rgba(red / CHANNEL_MAX, green / CHANNEL_MAX, blue / CHANNEL_MAX, alpha / CHANNEL_MAX);
  };
}

/**
 * The theme an element asks for through its `--chart-*` custom properties;
 * a token that is not set keeps the value of `base`. Read once, when the
 * chart is mounted and when the page theme changes — never in a frame (§8).
 */
export function themeFromCss(element: Element, base: IChartTheme): IChartTheme {
  const styles = getComputedStyle(element);
  const readColor = createColorReader();
  const text = (name: string): string | undefined => {
    const value = styles.getPropertyValue(`--chart-${name}`).trim();
    return value === '' ? undefined : value;
  };
  const color = (name: string, fallback: TColor): TColor => {
    const value = text(name);
    return isNil(value) ? fallback : (readColor(value) ?? fallback);
  };
  const size = (name: string, fallback: number): number => {
    const parsed = Number.parseFloat(text(name) ?? '');
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    background: color('background', base.background),
    grid: color('grid', base.grid),
    cut: color('cut', base.cut),
    axisLine: color('axis-line', base.axisLine),
    label: {
      text: color('label-text', base.label.text),
      background: color('label-background', base.label.background),
    },
    crosshair: {
      line: color('crosshair-line', base.crosshair.line),
      center: color('crosshair-center', base.crosshair.center),
      labelText: color('crosshair-label-text', base.crosshair.labelText),
      labelBackground: color('crosshair-label-background', base.crosshair.labelBackground),
    },
    font: {
      family: text('font-family') ?? base.font.family,
      size: size('font-size', base.font.size),
    },
    margin: base.margin,
    candle: {
      up: color('candle-up', base.candle.up),
      down: color('candle-down', base.candle.down),
      stroke: color('candle-stroke', base.candle.stroke),
    },
    loading: {
      light: color('loading-light', base.loading.light),
      dark: color('loading-dark', base.loading.dark),
      failed: color('loading-failed', base.loading.failed),
    },
  };
}
