import type { LucideIcon } from 'lucide-react';
import {
  Box,
  Brain,
  CandlestickChart,
  Gamepad2,
  Grid3x3,
  LandPlot,
  LineChart,
  Mountain,
  Shapes,
  SlidersHorizontal,
  StickyNote,
  Sun,
  Video,
} from 'lucide-react';
import type { appT } from './translations';

type TPageTitleKey = keyof typeof appT.pageTitles;

/**
 * Single source of truth for route-level metadata shared by the router
 * (`Application.tsx`), the navigation menu (`TopNav.tsx`), and the document
 * title hook (`useDocumentTitle.ts`).
 *
 * The router still owns the JSX route tree (nested routes, param variants,
 * lazy-loaded elements) — code-splitting must not be flattened into this
 * registry. This holds only the flat per-feature metadata those three
 * consumers were duplicating: path segment → title key, and the menu glyph.
 */
export interface IRouteMetadata {
  /** First path segment, e.g. `pendulum`. Empty string is the landing index. */
  readonly segment: string;
  /** Key into `appT.pageTitles` from which the display title / nav label reads. */
  readonly titleKey: TPageTitleKey;
  /** Lucide glyph shown in the navigation menu. Absent for non-nav routes. */
  readonly icon?: LucideIcon;
  /** Whether the route appears as a project entry in the navigation menu. */
  readonly navVisible: boolean;
}

/**
 * Ordered to match the navigation-menu project listing. The landing index
 * (`cv`) is title-only (`navVisible: false`) — it is reached via the brand
 * link, not the project list.
 */
export const ROUTE_METADATA: readonly IRouteMetadata[] = [
  { segment: '', titleKey: 'cv', navVisible: false },
  { segment: 'pendulum', titleKey: 'pendulum', icon: Brain, navVisible: true },
  { segment: 'sun', titleKey: 'sun', icon: Sun, navVisible: true },
  { segment: 'graphics', titleKey: 'graphics', icon: Shapes, navVisible: true },
  { segment: 'timeseries', titleKey: 'timeseries', icon: LineChart, navVisible: true },
  { segment: 'binance', titleKey: 'binance', icon: CandlestickChart, navVisible: true },
  { segment: 'sudoku', titleKey: 'sudoku', icon: Grid3x3, navVisible: true },
  { segment: 'tanks', titleKey: 'tanks', icon: Gamepad2, navVisible: true },
  { segment: 'scorched', titleKey: 'scorched', icon: Mountain, navVisible: true },
  { segment: 'stereometry', titleKey: 'stereometry', icon: Box, navVisible: true },
  { segment: 'site-planner', titleKey: 'sitePlanner', icon: LandPlot, navVisible: true },
  { segment: 'retro', titleKey: 'retro', icon: StickyNote, navVisible: true },
  { segment: 'conf', titleKey: 'conf', icon: Video, navVisible: true },
  { segment: 'controls', titleKey: 'controls', icon: SlidersHorizontal, navVisible: true },
];
