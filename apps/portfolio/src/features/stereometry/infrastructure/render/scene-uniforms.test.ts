/**
 * `webgpu-utils` reads the `GPUShaderStage` constants while it loads, and the
 * test environment has no WebGPU; the constants are the only thing the layout
 * parser needs.
 */
vi.stubGlobal('GPUShaderStage', { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 });

import type { StructDefinition, TypeDefinition } from 'webgpu-utils';

const { SCENE_UNIFORMS_DEFINITION } = await import('./scene-uniforms');

function isStruct(definition: TypeDefinition): definition is StructDefinition {
  return 'fields' in definition;
}

function offsetOf(field: string): number | undefined {
  const struct = SCENE_UNIFORMS_DEFINITION.typeDefinition;
  return isStruct(struct) ? struct.fields[field]?.offset : undefined;
}

describe('scene uniforms layout', () => {
  it('matches the std140 layout the shaders were written against', () => {
    expect(offsetOf('mvp')).toBe(0);
    expect(offsetOf('viewport')).toBe(64);
    expect(offsetOf('dpr')).toBe(72);
    expect(offsetOf('cameraDistance')).toBe(76);
    expect(offsetOf('cameraForward')).toBe(80);
    expect(offsetOf('cameraTarget')).toBe(96);
    expect(offsetOf('depthFadeRate')).toBe(108);
    expect(offsetOf('depthFadeMin')).toBe(112);
    expect(SCENE_UNIFORMS_DEFINITION.size).toBe(128);
  });
});
