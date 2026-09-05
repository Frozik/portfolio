import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { useMountedOnce } from '@frozik/components/hooks/useMountedOnce';
import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import { ArrowLeft, Home, Menu } from 'lucide-react';
import { lazy, memo, Suspense, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SvgGitHub } from '../../icons/SvgGitHub';
import { SvgQrCode } from '../../icons/SvgQrCode';
import { SvgRotateToLandscape } from '../../icons/SvgRotateToLandscape';
import { useFullscreenLandscape } from '../hooks/useFullscreenLandscape';
import { ROUTE_METADATA } from '../routeMetadata';
import { appT } from '../translations';
import type { INavProject } from './navTypes';
import { useTopNavBack } from './TopNavBackContext';
import { useTopNavCenterHostSetter } from './TopNavCenterContext';

const GITHUB_URL = 'https://github.com/frozik/portfolio';
const ICON_SIZE_PX = 16;

// Both overlays pull the Radix Dialog family (and the QR one qrcode.react) —
// none of it is needed before a click, so the chunks load on first open and
// are warmed up when the pointer reaches the button.
const loadQrDialog = () => import('./TopNavQrDialog');
const loadMobileSectionMenu = () => import('./MobileSectionMenu');
const TopNavQrDialog = lazy(() => loadQrDialog().then(m => ({ default: m.TopNavQrDialog })));
const MobileSectionMenu = lazy(() =>
  loadMobileSectionMenu().then(m => ({ default: m.MobileSectionMenu }))
);

const iconButtonClassName = cn(
  'group flex h-9 w-9 items-center justify-center rounded-sm',
  'border border-landing-border text-landing-fg-dim',
  'transition-colors',
  'hover:border-landing-accent hover:bg-landing-accent/10 hover:text-landing-accent',
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-landing-accent'
);

function scrollToSection(sectionId: string): void {
  const target = document.getElementById(sectionId);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', `#${sectionId}`);
  }
}

type TopNavVariant = 'landing' | 'inner';

const TopNavComponent = ({ variant = 'landing' }: { readonly variant?: TopNavVariant }) => {
  const [qrOpen, setQrOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const qrMounted = useMountedOnce(qrOpen);
  const menuMounted = useMountedOnce(menuOpen);
  const navigate = useNavigate();
  const fullscreen = useFullscreenLandscape();
  const { config: backConfig } = useTopNavBack();
  const setCenterHost = useTopNavCenterHostSetter();

  const handleBackActivate = useFunction(() => {
    if (backConfig !== null) {
      backConfig.onActivate();
    }
  });

  const handleQROpen = useFunction(() => setQrOpen(true));
  const handleQRClose = useFunction(() => setQrOpen(false));
  const handleMenuOpen = useFunction(() => setMenuOpen(true));
  const handleMenuClose = useFunction(() => setMenuOpen(false));
  const handleSectionNavigate = useFunction((sectionId: string) => {
    if (variant === 'inner') {
      void navigate(`/#${sectionId}`);
      return;
    }
    scrollToSection(sectionId);
  });
  const handleProjectNavigate = useFunction((route: string) => {
    void navigate(route);
  });

  const projects: readonly INavProject[] = useMemo(
    () =>
      ROUTE_METADATA.filter(entry => entry.navVisible).map(entry => {
        assert(!isNil(entry.icon), 'nav-visible route metadata must declare an icon');
        return {
          id: entry.segment,
          label: appT.pageTitles[entry.titleKey],
          route: `/${entry.segment}`,
          icon: entry.icon,
        };
      }),
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
      <nav className="sticky top-0 z-50 border-b border-landing-border bg-landing-bg/70 backdrop-blur-sm print:hidden">
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
              className="flex cursor-pointer items-center gap-1.5 bg-transparent p-0 font-mono text-[13px] text-landing-fg"
            >
              <Home size={ICON_SIZE_PX} className="text-landing-fg-dim" aria-hidden="true" />
              <span className="sr-only min-[450px]:not-sr-only">{appT.nav.brandRoot}</span>
              <span className="sr-only text-landing-fg-faint min-[450px]:not-sr-only">
                {appT.nav.brandPath}
              </span>
            </button>
          </div>

          <div ref={setCenterHost} className="flex min-w-0 flex-1 items-center justify-center" />

          <div className="flex items-center gap-1.5 md:gap-2">
            {fullscreen.isSupported && (
              <button
                type="button"
                onClick={fullscreen.toggle}
                className={cn(
                  iconButtonClassName,
                  fullscreen.isActive &&
                    'border-landing-accent bg-landing-accent/10 text-landing-accent'
                )}
                aria-label={appT.nav.fullscreenLandscape}
                aria-pressed={fullscreen.isActive}
                title={appT.nav.fullscreenLandscape}
              >
                <SvgRotateToLandscape className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={handleQROpen}
              onPointerEnter={loadQrDialog}
              onFocus={loadQrDialog}
              className={iconButtonClassName}
              aria-label={appT.nav.showQR}
              title={appT.nav.openOnPhone}
            >
              <SvgQrCode className="h-4 w-4" />
            </button>

            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={iconButtonClassName}
              aria-label={appT.nav.sourceOnGitHub}
              title={appT.nav.sourceOnGitHub}
            >
              <SvgGitHub width={ICON_SIZE_PX} height={ICON_SIZE_PX} />
            </a>

            <button
              type="button"
              onClick={handleMenuOpen}
              onPointerEnter={loadMobileSectionMenu}
              onFocus={loadMobileSectionMenu}
              className={iconButtonClassName}
              aria-label={appT.nav.openMenu}
            >
              <Menu size={ICON_SIZE_PX} />
            </button>
          </div>
        </div>
      </nav>

      <Suspense fallback={null}>
        {qrMounted && <TopNavQrDialog open={qrOpen} onClose={handleQRClose} />}
        {menuMounted && (
          <MobileSectionMenu
            open={menuOpen}
            onClose={handleMenuClose}
            sections={appT.nav.sections}
            showSections={isLanding}
            projects={projects}
            title={appT.nav.menuTitle}
            sectionsHeading={appT.nav.sectionsHeading}
            projectsHeading={appT.nav.projectsHeading}
            backToHomeLabel={appT.nav.backToHome}
            onNavigateSection={handleSectionNavigate}
            onNavigateProject={handleProjectNavigate}
            onNavigateHome={handleBrandClick}
          />
        )}
      </Suspense>
    </>
  );
};

export const TopNav = memo(TopNavComponent);
