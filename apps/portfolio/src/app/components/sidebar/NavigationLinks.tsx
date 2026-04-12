import {
  Brain,
  ChartLine,
  Gamepad2,
  Grid3X3,
  Info,
  Pyramid,
  SlidersHorizontal,
  Sun,
  TrendingUp,
} from 'lucide-react';
import { memo } from 'react';
import { NavLink } from 'react-router-dom';
import { SvgRotateToLandscape } from '../../../icons/SvgRotateToLandscape';
import { Tag, Tooltip } from '../../../shared/ui';
import { NAV_ICON_SIZE } from './constants';
import { navLinkClass } from './utils/navLinkClass';

export const NavigationLinks = memo(({ onNavigate }: { onNavigate: () => void }) => (
  <nav className="flex flex-col gap-4">
    <NavLink className={navLinkClass} to="/" onClick={onNavigate} end>
      <Gamepad2 size={NAV_ICON_SIZE} />
      <span>Curriculum Vitae</span>
    </NavLink>

    <div className="flex flex-col gap-1">
      <span className="px-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
        AI
      </span>
      <NavLink className={navLinkClass} to="/pendulum" onClick={onNavigate} end={false}>
        <Brain size={NAV_ICON_SIZE} />
        <span className="flex-1">Pendulum</span>
        <Tag color="red" className="md:hidden">
          Not optimized for mobile
        </Tag>
        <Tooltip
          title="Genetic algorithm evolves neural networks to balance an inverted pendulum."
          placement="right"
          className="max-w-64"
        >
          <Info size={14} className="hidden text-text-muted pointer-events-auto md:block" />
        </Tooltip>
      </NavLink>
    </div>

    <div className="flex flex-col gap-1">
      <span className="px-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
        WebGPU
      </span>
      <NavLink className={navLinkClass} to="/sun" onClick={onNavigate} end={false}>
        <Sun size={NAV_ICON_SIZE} />
        <span>Sun</span>
      </NavLink>
      <NavLink className={navLinkClass} to="/graphics" onClick={onNavigate} end={false}>
        <ChartLine size={NAV_ICON_SIZE} />
        <span className="flex-1">Graphics</span>
        <Tooltip
          title="GPU-accelerated rendering of shapes, lines with rounded joins, and transparency — near-zero CPU usage and minimal GPU overhead"
          placement="right"
          className="max-w-64"
        >
          <Info size={14} className="hidden text-text-muted pointer-events-auto md:block" />
        </Tooltip>
      </NavLink>
      <NavLink className={navLinkClass} to="/timeseries" onClick={onNavigate} end={false}>
        <TrendingUp size={NAV_ICON_SIZE} />
        <span className="flex-1">Timeseries</span>
        <SvgRotateToLandscape className="hidden h-5 w-5 animate-pulse text-info md:hidden max-md:block" />
        <Tooltip
          title="WebGPU timeseries chart capable of rendering gigabytes of data at high FPS with near-zero CPU usage"
          placement="right"
          className="max-w-64"
        >
          <Info size={14} className="hidden text-text-muted pointer-events-auto md:block" />
        </Tooltip>
      </NavLink>
    </div>

    <div className="flex flex-col gap-1">
      <span className="px-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
        Games
      </span>
      <NavLink className={navLinkClass} to="/sudoku" onClick={onNavigate} end={false}>
        <Grid3X3 size={NAV_ICON_SIZE} />
        <span>Sudoku</span>
      </NavLink>
      <NavLink className={navLinkClass} to="/stereometry" onClick={onNavigate} end={false}>
        <Pyramid size={NAV_ICON_SIZE} />
        <span>Stereometry</span>
      </NavLink>
    </div>

    <div className="flex flex-col gap-1">
      <span className="px-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
        UI/UX
      </span>
      <NavLink className={navLinkClass} to="/controls" onClick={onNavigate} end>
        <SlidersHorizontal size={NAV_ICON_SIZE} />
        <span>Controls</span>
      </NavLink>
    </div>
  </nav>
));
