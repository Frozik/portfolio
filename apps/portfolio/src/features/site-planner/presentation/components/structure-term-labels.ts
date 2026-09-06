import { assertNever } from '@frozik/utils/assert/assertNever';
import type { LucideIcon } from 'lucide-react';
import { Circle, Egg, Folder, Square } from 'lucide-react';
import { formatMeters } from '../../application/render/plan-draw/shared';
import type { CsgOperand, Shape, ShapeGroup } from '../../domain/model/shapes';
import { flattenShapes, isShapeGroup } from '../../domain/model/shapes';
import { METER_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';

/** How a term reads in the tree: its icon and the caption its dimensions make. */
const DIMENSION_SEPARATOR = ' × ';

export function operandIcon(operand: CsgOperand): LucideIcon {
  switch (operand.kind) {
    case 'group':
      return Folder;
    case 'rectangle':
      return Square;
    case 'circle':
      return Circle;
    case 'ellipse':
      return Egg;
    default:
      return assertNever(operand);
  }
}

export function describeOperand(operand: CsgOperand): string {
  return isShapeGroup(operand) ? describeGroup(operand) : describeShape(operand);
}

export function describeGroup(group: ShapeGroup): string {
  return `${sitePlannerT.structure.group} (${flattenShapes(group).length})`;
}

export function describeShape(shape: Shape): string {
  const { meterUnit } = sitePlannerT.plan;

  switch (shape.kind) {
    case 'rectangle':
    case 'ellipse':
      return `${shape.width.toFixed(METER_DECIMALS)}${DIMENSION_SEPARATOR}${formatMeters(shape.length, meterUnit)}`;
    case 'circle':
      return `${sitePlannerT.structure.radiusPrefix} ${formatMeters(shape.radius, meterUnit)}`;
    default:
      return assertNever(shape);
  }
}
