import { describe, expect, it } from 'vitest';

import type { CircuitGroupId, DeviceId } from './electrical';
import { derivePanelAssembly } from './panel-assembly';

const PANEL_ID = 'panel' as DeviceId;

describe('derivePanelAssembly', () => {
  it('puts a breaker per group behind an incomer, rated by the cable', () => {
    const assembly = derivePanelAssembly(PANEL_ID, [
      {
        id: 'sockets' as CircuitGroupId,
        cableTypeId: 'vvg-3x2.5',
        consumerKinds: ['outlet', 'outlet'],
        isWet: false,
        roomTypeId: 'living',
      },
      {
        id: 'lights' as CircuitGroupId,
        cableTypeId: 'vvg-3x1.5',
        consumerKinds: ['light'],
        isWet: false,
        roomTypeId: undefined,
      },
    ]);

    expect(assembly.modules.map(module => `${module.designation} ${module.amperes}`)).toEqual([
      'QF0 25',
      'QF1 16',
      'QF2 10',
    ]);
    expect(assembly.modules[1].purpose).toBe('sockets');
    expect(assembly.modules[2].purpose).toBe('lighting');
    expect(assembly.usedModules).toBe(4);
    expect(assembly.enclosureModules).toBe(12);
  });

  it('protects a wet room with a two-module RCBO', () => {
    const assembly = derivePanelAssembly(PANEL_ID, [
      {
        id: 'bath' as CircuitGroupId,
        cableTypeId: 'vvg-3x2.5',
        consumerKinds: ['outlet'],
        isWet: true,
        roomTypeId: 'bathroom',
      },
    ]);

    expect(assembly.modules[1].kind).toBe('rcbo');
    expect(assembly.modules[1].width).toBe(2);
  });

  it('grows the enclosure with the rail, keeping a fifth in reserve', () => {
    const groups = Array.from({ length: 12 }, (_, index) => ({
      id: `group-${index}` as CircuitGroupId,
      cableTypeId: 'vvg-3x2.5' as const,
      consumerKinds: ['outlet' as const],
      isWet: false,
      roomTypeId: undefined,
    }));
    const assembly = derivePanelAssembly(PANEL_ID, groups);

    // 2 + 12 = 14 modules, ×1.2 = 17 → the 18-module box; the incomer sees
    // 12 × 16 A × 0.5 = 96 A and takes the largest stock rating.
    expect(assembly.usedModules).toBe(14);
    expect(assembly.enclosureModules).toBe(18);
    expect(assembly.modules[0].amperes).toBe(63);
  });
});
