import { useFunction } from '@frozik/components/hooks/useFunction';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  Box,
  Brain,
  CandlestickChart,
  Grid3x3,
  LineChart,
  Menu,
  Shapes,
  SlidersHorizontal,
  StickyNote,
  Sun,
  Video,
} from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { welcomeT } from '../../features/welcome/presentation/translations';
import { SvgGitHub } from '../../icons/SvgGitHub';
import { SvgRotateToLandscape } from '../../icons/SvgRotateToLandscape';
import { cn } from '../../shared/lib/cn';
import { Modal } from '../../shared/ui/Modal';
import { QRCode } from '../../shared/ui/QRCode';
import { useFullscreenLandscape } from '../hooks/useFullscreenLandscape';
import type { INavProject } from './MobileSectionMenu';
import { MobileSectionMenu } from './MobileSectionMenu';
import { useTopNavBack } from './TopNavBackContext';

const GITHUB_URL = 'https://github.com/frozik/portfolio';
const QR_SIZE_PX = 216;
const ICON_SIZE_PX = 16;

/**
 * Stable ordering of the projects shown in the drawer menu. Each id
 * corresponds both to the route segment (`/${id}`) and to an entry in
 * `welcomeT.projects.entries` from which the display title is read.
 * Icon is a small lucide glyph that hints at the project's theme.
 */
const PROJECT_ENTRIES: readonly { readonly id: string; readonly icon: LucideIcon }[] = [
  { id: 'pendulum', icon: Brain },
  { id: 'sun', icon: Sun },
  { id: 'graphics', icon: Shapes },
  { id: 'timeseries', icon: LineChart },
  { id: 'binance', icon: CandlestickChart },
  { id: 'sudoku', icon: Grid3x3 },
  { id: 'stereometry', icon: Box },
  { id: 'retro', icon: StickyNote },
  { id: 'conf', icon: Video },
  { id: 'controls', icon: SlidersHorizontal },
];

const iconButtonClassName = cn(
  'group flex h-9 w-9 items-center justify-center rounded-sm',
  'border border-landing-border text-landing-fg-dim',
  'transition-colors',
  'hover:border-landing-accent hover:bg-landing-accent/10 hover:text-landing-accent',
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-landing-accent'
);

function IconQR() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="5.5" y="5.5" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="16.5" y="5.5" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="5.5" y="16.5" width="2" height="2" fill="currentColor" stroke="none" />
      <path d="M14 14h3v3M17 19h1M20 14v1M20 17v4M14 19h1" />
    </svg>
  );
}

function scrollToSection(sectionId: string): void {
  const target = document.getElementById(sectionId);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', `#${sectionId}`);
  }
}

function getCurrentPageUrl(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.location.href;
}

type TopNavVariant = 'landing' | 'inner';

type TopNavProps = {
  readonly variant?: TopNavVariant;
};

const TopNavComponent = ({ variant = 'landing' }: TopNavProps) => {
  const [qrOpen, setQrOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const fullscreen = useFullscreenLandscape();
  const { config: backConfig } = useTopNavBack();

  const handleBackActivate = useFunction(() => {
    if (backConfig !== null) {
      backConfig.onActivate();
    }
  });

  const handleQROpen = useFunction(() => setQrOpen(true));
  const handleQRClose = useFunction(() => setQrOpen(false));
  const handleMenuOpen = useFunction(() => setMenuOpen(true));
  const handleMenuClose = useFunction(() => setMenuOpen(false));
  const handleSectionNavigate = useFunction((sectionId: string) => scrollToSection(sectionId));
  const handleProjectNavigate = useFunction((route: string) => {
    void navigate(route);
  });

  const projects: readonly INavProject[] = useMemo(
    () =>
      PROJECT_ENTRIES.map(entry => ({
        id: entry.id,
        label: welcomeT.projects.entries[entry.id]?.title ?? entry.id,
        route: `/${entry.id}`,
        icon: entry.icon,
      })),
    []
  );

  const handleBrandClick = useFunction(() => {
    if (variant === 'inner') {
      navigate('/');
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    history.replaceState(null, '', window.location.pathname + window.location.search);
  });

  const isLanding = variant === 'landing';

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-landing-border bg-landing-bg/70 backdrop-blur-xl print:hidden">
        <div className="mx-auto flex max-w-[var(--container-narrow)] items-center justify-between gap-3 px-6 py-2 md:gap-6 md:px-12">
          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            {backConfig !== null && (
              <button
                type="button"
                onClick={handleBackActivate}
                className={iconButtonClassName}
                aria-label={backConfig.label}
                title={backConfig.label}
              >
                <ArrowLeft size={ICON_SIZE_PX} />
              </button>
            )}
            <button
              type="button"
              onClick={handleBrandClick}
              className="cursor-pointer bg-transparent p-0 font-mono text-[13px] text-landing-fg"
            >
              {welcomeT.nav.brandRoot}
              <span className="text-landing-fg-faint">{welcomeT.nav.brandPath}</span>
            </button>
          </div>

          {isLanding && (
            <div className="hidden font-mono text-xs text-landing-fg-dim min-[990px]:flex min-[990px]:gap-8">
              {welcomeT.nav.sections.map(section => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="transition-colors hover:text-landing-fg"
                >
                  <span className="mr-1.5 text-landing-fg-faint">{section.number}</span>
                  {section.label}
                </a>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5 md:gap-2">
            {fullscreen.isSupported && (
              <button
                type="button"
                onClick={fullscreen.enter}
                className={iconButtonClassName}
                aria-label={welcomeT.nav.fullscreenLandscape}
                title={welcomeT.nav.fullscreenLandscape}
              >
                <SvgRotateToLandscape className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={handleQROpen}
              className={iconButtonClassName}
              aria-label={welcomeT.nav.showQR}
              title={welcomeT.nav.openOnPhone}
            >
              <IconQR />
            </button>

            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={iconButtonClassName}
              aria-label={welcomeT.nav.sourceOnGitHub}
              title={welcomeT.nav.sourceOnGitHub}
            >
              <SvgGitHub width={ICON_SIZE_PX} height={ICON_SIZE_PX} />
            </a>

            <button
              type="button"
              onClick={handleMenuOpen}
              className={iconButtonClassName}
              aria-label={welcomeT.nav.openMenu}
            >
              <Menu size={ICON_SIZE_PX} />
            </button>
          </div>
        </div>
      </nav>

      <Modal
        open={qrOpen}
        onClose={handleQRClose}
        title={welcomeT.nav.openOnPhone}
        description="URL"
        closeLabel={welcomeT.nav.closeQR}
      >
        <div className="mb-5 flex justify-center rounded-sm bg-white p-4">
          <QRCode value={getCurrentPageUrl()} size={QR_SIZE_PX} className="bg-transparent p-0" />
        </div>
        <div className="break-all font-mono text-[12px] leading-[1.5] text-landing-fg-dim">
          {getCurrentPageUrl()}
        </div>
      </Modal>

      <MobileSectionMenu
        open={menuOpen}
        onClose={handleMenuClose}
        sections={welcomeT.nav.sections}
        showSections={isLanding}
        projects={projects}
        title={welcomeT.nav.menuTitle}
        sectionsHeading={welcomeT.nav.sectionsHeading}
        projectsHeading={welcomeT.nav.projectsHeading}
        onNavigateSection={handleSectionNavigate}
        onNavigateProject={handleProjectNavigate}
      />
    </>
  );
};

export const TopNav = memo(TopNavComponent);
