import { useFunction } from '@frozik/components';
import { isEmpty, isNil } from 'lodash-es';
import {
  Brain,
  ChartLine,
  Eye,
  Gamepad2,
  Grid3X3,
  Info,
  Menu,
  Network,
  QrCode,
  SlidersHorizontal,
  Sun,
  TrendingUp,
} from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useToggle } from 'usehooks-ts';
import { SvgGitHub } from '../../icons/SvgGitHub';
import { cn } from '../../shared/lib/cn';
import { Drawer, FloatingButton, FloatingButtonGroup, QRCode, Tag, Tooltip } from '../../shared/ui';
import { useRootStore } from '../stores';
import type { IMenuAction } from '../stores/CommonStore';
import styles from './SidebarNavigation.module.scss';

const ICON_SIZE = 18;
const NAV_ICON_SIZE = 16;

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return cn(
    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium no-underline transition-colors',
    isActive
      ? 'bg-brand-500/15 text-brand-400 pointer-events-none'
      : 'text-text-secondary hover:bg-surface-overlay hover:text-text'
  );
}

// No observer here — observer blocks React Router context propagation to Outlet.
// MobX reactivity is scoped to MenuButton which is a separate observer component.
export const SidebarNavigation = memo(() => {
  const [visible, toggleVisible, setVisible] = useToggle(false);
  const [showQR, toggleQR, setShowQR] = useToggle(false);
  const location = useLocation();
  const handleToggle = useFunction(() => toggleVisible());
  const handleClose = useFunction(() => {
    setVisible(false);
    setShowQR(false);
  });
  const handleToggleQR = useFunction(() => toggleQR());

  const drawerTitle = (
    <span className="flex items-center gap-2">
      <a
        href="https://github.com/Frozik/portfolio"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-text hover:text-text-secondary"
      >
        <SvgGitHub width={16} height={16} />
        <span className="font-mono text-sm">frozik</span>
      </a>
      <button
        className="rounded-md p-1 text-text-secondary hover:bg-surface-overlay hover:text-text"
        onClick={handleToggleQR}
      >
        <QrCode size={18} />
      </button>
    </span>
  );

  const currentUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}${location.pathname}`;

  return (
    <>
      <Drawer
        title={drawerTitle}
        className={styles.sidebar}
        placement="left"
        open={visible}
        onClose={handleClose}
      >
        {showQR ? (
          <div className="flex flex-col items-center gap-3 pt-4">
            <QRCode value={currentUrl} size={200} />
            <p className="text-center text-sm text-text-secondary">Scan to open this page</p>
          </div>
        ) : (
          <nav className="flex flex-col gap-1">
            <NavLink className={navLinkClass} to="/" onClick={handleClose} end>
              <Gamepad2 size={NAV_ICON_SIZE} />
              <span>Curriculum Vitae</span>
            </NavLink>

            <NavLink className={navLinkClass} to="/pendulum" onClick={handleClose} end={false}>
              <Brain size={NAV_ICON_SIZE} />
              <span className="flex-1">Pendulum</span>
              <Tooltip
                title={
                  <>
                    Genetic algorithm evolves neural networks to balance an inverted pendulum.
                    <br />
                    <Tag color="red" className="mt-1">
                      Not optimized for mobile devices
                    </Tag>
                  </>
                }
                placement="right"
                className="max-w-64"
              >
                <Info size={14} className="hidden text-text-muted pointer-events-auto md:block" />
              </Tooltip>
            </NavLink>

            <NavLink className={navLinkClass} to="/sudoku" onClick={handleClose} end={false}>
              <Grid3X3 size={NAV_ICON_SIZE} />
              <span>Sudoku</span>
            </NavLink>

            <NavLink className={navLinkClass} to="/sun" onClick={handleClose} end={false}>
              <Sun size={NAV_ICON_SIZE} />
              <span>Sun</span>
            </NavLink>

            <NavLink className={navLinkClass} to="/graphics" onClick={handleClose} end={false}>
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

            <NavLink className={navLinkClass} to="/timeseries" onClick={handleClose} end={false}>
              <TrendingUp size={NAV_ICON_SIZE} />
              <span className="flex-1">Timeseries</span>
              <Tooltip
                title="WebGPU timeseries chart capable of rendering gigabytes of data stored in GPU textures. R-tree spatial index selects visible segments, delta encoding preserves float32 precision for large timestamps. Multi-scale zoom with lazy data loading, pan, and auto-scaling Y-axis"
                placement="right"
                className="max-w-64"
              >
                <Info size={14} className="hidden text-text-muted pointer-events-auto md:block" />
              </Tooltip>
            </NavLink>

            <NavLink className={navLinkClass} to="/controls" onClick={handleClose} end>
              <SlidersHorizontal size={NAV_ICON_SIZE} />
              <span>Controls</span>
            </NavLink>
          </nav>
        )}
      </Drawer>

      <MenuButton onOpen={handleToggle} />
    </>
  );
});

// Separate observer component for MobX-reactive menu actions.
// Scoped observer boundary keeps router context propagation intact.
const MenuButton = observer(({ onOpen }: { onOpen: () => void }) => {
  const menuActions = useRootStore().commonStore.menuActions;

  if (menuActions.length === 0) {
    return (
      <FloatingButton
        className={styles.sidebarMenuOpener}
        icon={<Menu size={ICON_SIZE} />}
        type="primary"
        onClick={onOpen}
      />
    );
  }

  return (
    <FloatingButtonGroup
      className={styles.sidebarMenuOpener}
      icon={<Menu size={ICON_SIZE} />}
      trigger="hover"
      type="primary"
      onClick={onOpen}
    >
      {menuActions.map(action => (
        <MenuActionIcon key={action.name} action={action} />
      ))}
    </FloatingButtonGroup>
  );
});

const MenuActionIcon = observer(({ action }: { action: IMenuAction }) => {
  const handleClick = useFunction(() => action.callback());

  const icon = getIconElement(action.icon);

  const button = <FloatingButton icon={icon} onClick={handleClick} inline />;

  return isEmpty(action.tooltip) ? (
    button
  ) : (
    <Tooltip title={action.tooltip} placement="right">
      {button}
    </Tooltip>
  );
});

function getIconElement(iconName: string | undefined): React.ReactElement | undefined {
  if (isNil(iconName)) {
    return undefined;
  }

  switch (iconName) {
    case 'eye':
      return <Eye size={ICON_SIZE} />;
    case 'network':
      return <Network size={ICON_SIZE} />;
    default:
      return undefined;
  }
}
