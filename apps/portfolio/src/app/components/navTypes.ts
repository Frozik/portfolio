import type { LucideIcon } from 'lucide-react';

export const PROJECT_ICON_SIZE_PX = 16;

export interface INavProject {
  readonly id: string;
  readonly label: string;
  readonly route: string;
  readonly icon: LucideIcon;
}
