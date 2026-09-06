import { describe, expect, it } from 'vitest';

import { createBuilding } from './building';
import {
  allowedPlanTools,
  describeEditedObject,
  editedPathId,
  editorDoorFor,
  editorToolbar,
  editorToolForHotkey,
  isPlanTool,
  isToolAllowed,
  OBJECT_EDITOR_SPECS,
  VIEW_MODE,
} from './editor-mode';
import { createCarId, createPathId, createSitePath, createTreeId } from './plot-objects';
import { createUtilityRoute } from './routing';
import { createMarkId } from './site-plan';

describe('allowedPlanTools', () => {
  it('offers the arranging tools in view mode and none of the drawing ones', () => {
    const tools = allowedPlanTools(VIEW_MODE);

    expect(tools).toContain('select');
    expect(tools).toContain('pan');
    expect(tools).toContain('tree');
    expect(tools).toContain('path');
    expect(tools).not.toContain('rectangle');
    expect(tools).not.toContain('elevation');
  });

  it('offers the ground-plan tools inside site editing', () => {
    const tools = allowedPlanTools({ kind: 'edit', target: { kind: 'site' } });

    expect(tools).toContain('rectangle');
    expect(tools).toContain('circle');
    expect(tools).toContain('elevation');
    expect(tools).toContain('path');
    expect(tools).not.toContain('tree');
  });

  it('leaves path editing nothing but selection', () => {
    const pathId = createPathId();

    expect(allowedPlanTools({ kind: 'edit', target: { kind: 'path', pathId } })).toEqual([
      'select',
      'pan',
    ]);
  });
});

describe('isToolAllowed', () => {
  it('answers from the same table the rail renders from', () => {
    expect(isToolAllowed(VIEW_MODE, 'measure')).toBe(true);
    expect(isToolAllowed(VIEW_MODE, 'circle')).toBe(false);
  });

  it('refuses an editor tool outside its own editor', () => {
    expect(isToolAllowed(VIEW_MODE, 'site:imaginary')).toBe(false);
  });
});

describe('editorToolbar', () => {
  it('lays out the shared tools followed by the editor its own', () => {
    const pathId = createPathId();

    expect(editorToolbar(VIEW_MODE)).toEqual(allowedPlanTools(VIEW_MODE));
    expect(editorToolbar({ kind: 'edit', target: { kind: 'site' } })).toEqual([
      ...allowedPlanTools({ kind: 'edit', target: { kind: 'site' } }),
      ...OBJECT_EDITOR_SPECS.site.ownTools.map(tool => tool.id),
    ]);
    expect(editorToolbar({ kind: 'edit', target: { kind: 'path', pathId } })).toEqual([
      ...allowedPlanTools({ kind: 'edit', target: { kind: 'path', pathId } }),
      ...OBJECT_EDITOR_SPECS.path.ownTools.map(tool => tool.id),
    ]);
  });
});

describe('isPlanTool', () => {
  it('tells the shared tools from the namespaced editor ones', () => {
    expect(isPlanTool('select')).toBe(true);
    expect(isPlanTool('site:wall')).toBe(false);
  });
});

describe('editorToolForHotkey', () => {
  it('arms nothing while viewing and nothing an editor did not contribute', () => {
    expect(editorToolForHotkey(VIEW_MODE, 'w')).toBeUndefined();
    expect(editorToolForHotkey({ kind: 'edit', target: { kind: 'site' } }, 'w')).toBeUndefined();
  });
});

describe('editedPathId', () => {
  it('names the path only while its editor is open', () => {
    const pathId = createPathId();

    expect(editedPathId(VIEW_MODE)).toBeUndefined();
    expect(editedPathId({ kind: 'edit', target: { kind: 'site' } })).toBeUndefined();
    expect(editedPathId({ kind: 'edit', target: { kind: 'path', pathId } })).toBe(pathId);
  });
});

describe('editorDoorFor', () => {
  it('opens the path editor for a selected path', () => {
    const pathId = createPathId();

    expect(editorDoorFor({ kind: 'path', pathId })).toEqual({
      target: { kind: 'path', pathId },
      aimAt: undefined,
    });
  });

  it('opens the building editor for the selected building', () => {
    const building = createBuilding({ name: 'Дом' });

    expect(editorDoorFor({ kind: 'building', buildingId: building.id })).toEqual({
      target: { kind: 'building', buildingId: building.id },
      aimAt: undefined,
    });
  });

  it('offers no door for the objects with no anatomy to open', () => {
    expect(editorDoorFor({ kind: 'tree', treeId: createTreeId() })).toBeUndefined();
    expect(editorDoorFor({ kind: 'car', carId: createCarId() })).toBeUndefined();
    expect(editorDoorFor({ kind: 'mark', markId: createMarkId() })).toBeUndefined();
  });
});

describe('describeEditedObject', () => {
  const paths = [
    createSitePath({
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ],
      width: 1,
    }),
    createSitePath({
      points: [
        { x: 0, y: 2 },
        { x: 4, y: 2 },
      ],
      width: 1,
    }),
  ];
  const building = createBuilding({ name: 'Кладовка' });

  it('names nothing while viewing', () => {
    expect(
      describeEditedObject(VIEW_MODE, {
        activeOwner: 'boundary',
        buildings: [building],
        paths,
        utilityRoutes: [],
      })
    ).toBeUndefined();
  });

  it('names the site while its editor is aimed at the plot', () => {
    expect(
      describeEditedObject(
        { kind: 'edit', target: { kind: 'site' } },
        { activeOwner: 'boundary', buildings: [building], paths, utilityRoutes: [] }
      )
    ).toEqual({ kind: 'site' });
  });

  it('names the building that site editing is aimed at', () => {
    expect(
      describeEditedObject(
        { kind: 'edit', target: { kind: 'site' } },
        { activeOwner: building.id, buildings: [building], paths, utilityRoutes: [] }
      )
    ).toEqual({ kind: 'building', name: 'Кладовка' });
  });

  it('numbers the edited path by its place in the plan', () => {
    expect(
      describeEditedObject(
        { kind: 'edit', target: { kind: 'path', pathId: paths[1].id } },
        { activeOwner: 'boundary', buildings: [building], paths, utilityRoutes: [] }
      )
    ).toEqual({ kind: 'path', ordinal: 2 });
  });

  it('numbers the edited trench by its place in the plan', () => {
    const routes = [
      createUtilityRoute({ system: 'water', points: [] }),
      createUtilityRoute({ system: 'sewer', points: [] }),
    ];

    expect(
      describeEditedObject(
        { kind: 'edit', target: { kind: 'utilityRoute', routeId: routes[1].id } },
        { activeOwner: 'boundary', buildings: [building], paths, utilityRoutes: routes }
      )
    ).toEqual({ kind: 'utilityRoute', ordinal: 2 });
  });
});
