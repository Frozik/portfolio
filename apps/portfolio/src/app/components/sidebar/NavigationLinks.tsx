import {
  Activity,
  Brain,
  ChartLine,
  Gamepad2,
  Grid3X3,
  Info,
  Pyramid,
  SlidersHorizontal,
  Sun,
  TrendingUp,
  Users,
} from 'lucide-react';
import { memo } from 'react';
import { NavLink } from 'react-router-dom';
import { SvgRotateToLandscape } from '../../../icons/SvgRotateToLandscape';
import { Tag, Tooltip } from '../../../shared/ui';
import { appT } from '../../translations';
import { NAV_ICON_SIZE } from './constants';
import { navLinkClass } from './utils/navLinkClass';

export const NavigationLinks = memo(({ onNavigate }: { onNavigate: () => void }) => (
  <nav className="flex flex-col gap-4">
    <NavLink className={navLinkClass} to="/" onClick={onNavigate} end>
      <Gamepad2 size={NAV_ICON_SIZE} />
      <span>{appT.navigation.curriculumVitae}</span>
    </NavLink>

    <div className="flex flex-col gap-1">
      <span className="px-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
        {appT.navigation.sectionAI}
      </span>
      <NavLink className={navLinkClass} to="/pendulum" onClick={onNavigate} end={false}>
        <Brain size={NAV_ICON_SIZE} />
        <span className="flex-1">{appT.navigation.pendulum}</span>
        <Tag color="red" className="md:hidden">
          {appT.navigation.pendulumMobileWarning}
        </Tag>
        <Tooltip title={appT.navigation.pendulumTooltip} placement="right" className="max-w-64">
          <Info size={14} className="hidden text-text-muted pointer-events-auto md:block" />
        </Tooltip>
      </NavLink>
    </div>

    <div className="flex flex-col gap-1">
      <span className="px-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
        {appT.navigation.sectionWebGPU}
      </span>
      <NavLink className={navLinkClass} to="/sun" onClick={onNavigate} end={false}>
        <Sun size={NAV_ICON_SIZE} />
        <span>{appT.navigation.sun}</span>
      </NavLink>
      <NavLink className={navLinkClass} to="/graphics" onClick={onNavigate} end={false}>
        <ChartLine size={NAV_ICON_SIZE} />
        <span className="flex-1">{appT.navigation.graphics}</span>
        <Tooltip title={appT.navigation.graphicsTooltip} placement="right" className="max-w-64">
          <Info size={14} className="hidden text-text-muted pointer-events-auto md:block" />
        </Tooltip>
      </NavLink>
      <NavLink className={navLinkClass} to="/timeseries" onClick={onNavigate} end={false}>
        <TrendingUp size={NAV_ICON_SIZE} />
        <span className="flex-1">{appT.navigation.timeseries}</span>
        <SvgRotateToLandscape className="hidden h-5 w-5 animate-pulse text-info md:hidden max-md:block" />
        <Tooltip title={appT.navigation.timeseriesTooltip} placement="right" className="max-w-64">
          <Info size={14} className="hidden text-text-muted pointer-events-auto md:block" />
        </Tooltip>
      </NavLink>
      <NavLink className={navLinkClass} to="/binance" onClick={onNavigate} end={false}>
        <Activity size={NAV_ICON_SIZE} />
        <span className="flex-1">{appT.navigation.binance}</span>
        <Tooltip title={appT.navigation.binanceTooltip} placement="right" className="max-w-64">
          <Info size={14} className="hidden text-text-muted pointer-events-auto md:block" />
        </Tooltip>
      </NavLink>
    </div>

    <div className="flex flex-col gap-1">
      <span className="px-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
        {appT.navigation.sectionGames}
      </span>
      <NavLink className={navLinkClass} to="/sudoku" onClick={onNavigate} end={false}>
        <Grid3X3 size={NAV_ICON_SIZE} />
        <span>{appT.navigation.sudoku}</span>
      </NavLink>
      <NavLink className={navLinkClass} to="/stereometry" onClick={onNavigate} end={false}>
        <Pyramid size={NAV_ICON_SIZE} />
        <span>{appT.navigation.stereometry}</span>
      </NavLink>
    </div>

    <div className="flex flex-col gap-1">
      <span className="px-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
        {appT.navigation.sectionCollab}
      </span>
      <NavLink className={navLinkClass} to="/retro" onClick={onNavigate} end={false}>
        <Users size={NAV_ICON_SIZE} />
        <span className="flex-1">{appT.navigation.retro}</span>
        <Tooltip title={appT.navigation.retroTooltip} placement="right" className="max-w-64">
          <Info size={14} className="hidden text-text-muted pointer-events-auto md:block" />
        </Tooltip>
      </NavLink>
    </div>

    <div className="flex flex-col gap-1">
      <span className="px-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
        {appT.navigation.sectionUIUX}
      </span>
      <NavLink className={navLinkClass} to="/controls" onClick={onNavigate} end>
        <SlidersHorizontal size={NAV_ICON_SIZE} />
        <span>{appT.navigation.controls}</span>
      </NavLink>
    </div>
  </nav>
));
