import { SCENE_BACKGROUND_HEX } from '@frozik/utils/webgpu/backgroundColor';

import type { PartialElementStyle } from './style-resolver';

/**
 * Visual styles for stereometry scene elements, shared by the WebGPU scene
 * (`styled-scene.ts`) and the SVG solution previews (`SolutionPreview.tsx`).
 *
 * Keys follow the format 'element:modifier1:modifier2' where modifiers
 * are sorted alphabetically. The resolver cascades from general to specific.
 */
export const STEREOMETRY_STYLES = {
  line: {
    color: '#FFFFFF',
    width: 1.0,
    alpha: 1.0,
    line: { type: 'solid' as const },
  },
  'line:hidden': {
    alpha: 0.3,
    // dash/gap are WORLD units (anchored to geometry, stable under camera
    // motion); 0.05 ≈ the former 10 css px at the default camera distance
    line: { type: 'dashed' as const, dash: 0.05, gap: 0.05 },
  },
  'line:selected': {
    color: '#55AAFF',
  },
  'line:hidden:selected': {
    alpha: 1,
  },
  'line:segment': {
    width: 3.0,
  },
  'line:preview': {
    color: '#4488BB',
  },
  'line:inner': {
    width: 3.0,
  },
  'line:input': {
    color: '#FF8973',
    width: 3.0,
    alpha: 1,
  },
  'line:input:hidden': {
    alpha: 0.3,
  },
  'line:segment:input:hidden': {
    alpha: 0.3,
  },
  'line:input:selected': {
    color: '#A61A00',
  },
  'line:segment:input': {
    color: '#FF8973',
    width: 3.0,
    alpha: 1,
  },
  'line:segment:input:selected': {
    color: '#A61A00',
  },
  'line:solution': {
    color: '#EFBF04',
  },

  vertex: {
    markerType: 'circle',
    color: '#000000',
    size: 10,
    strokeColor: '#FFFFFF',
    strokeWidth: 2,
  },
  'vertex:hidden': {
    strokeColor: '#999999',
  },
  'vertex:selected': {
    color: '#55AAFF',
  },
  'vertex:hidden:selected': {
    color: '#3388DD',
  },
  'vertex:inner': {
    strokeColor: '#AAFF44',
    color: '#AAAAAA',
  },
  'vertex:inner:hidden': {
    strokeColor: '#77CC22',
    color: '#000000',
  },
  'vertex:preview': {
    color: '#000000',
    strokeColor: '#4488BB',
    strokeWidth: 6,
    size: 16,
  },
  'vertex:input': {
    markerType: 'solid',
    color: '#FF8973',
    size: 10,
  },
  'vertex:input:hidden': {
    markerType: 'solid',
    color: '#FF8973',
    size: 10,
    alpha: 0.6,
  },
  'vertex:input:selected': {
    markerType: 'solid',
    color: '#A61A00',
    size: 10,
  },
  'vertex:solution': {
    markerType: 'solid',
    color: '#EFBF04',
  },
  'vertex:solution:hidden': {
    markerType: 'solid',
    color: '#EFBF04',
  },

  'face:solution': {
    color: '#EFBF04',
    alpha: 0.1,
  },

  background: {
    color: SCENE_BACKGROUND_HEX,
  },
} satisfies Readonly<Record<string, PartialElementStyle>>;
