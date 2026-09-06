import type { BuildingTemplate } from '../model/building-template';
import { bathHouse } from './houses/bath-house';
import { dachaHouse } from './houses/dacha-house';
import { familyCottage } from './houses/family-cottage';
import { garage } from './houses/garage';
import { gardenStudio } from './houses/garden-studio';
import { grangeHouse } from './houses/grange-house';
import { manor } from './houses/manor';
import { residence } from './houses/residence';
import { terraceHouse } from './houses/terrace-house';
import { twoStoreyCottage } from './houses/two-storey-cottage';

export const STOCK_HOUSE_TEMPLATES: readonly BuildingTemplate[] = [
  { id: 'terrace-house-16x13', building: terraceHouse() },
  { id: 'residence-19x12', building: residence() },
  { id: 'manor-12x11', building: manor() },
  { id: 'grange-15x10', building: grangeHouse() },
  { id: 'family-cottage-10x9', building: familyCottage() },
  { id: 'cottage-8x9', building: twoStoreyCottage() },
  { id: 'dacha-8x6', building: dachaHouse() },
  { id: 'bath-6x4', building: bathHouse() },
  { id: 'garage-4x7', building: garage() },
  { id: 'studio-4x3', building: gardenStudio() },
];

export function findStockHouseTemplate(id: string): BuildingTemplate | undefined {
  return STOCK_HOUSE_TEMPLATES.find(template => template.id === id);
}
