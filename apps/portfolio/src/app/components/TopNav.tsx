import { useFunction } from '@frozik/components';
import { Menu } from 'lucide-react';
import { memo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { welcomeT } from '../../features/welcome/presentation/translations';
import { SvgGitHub } from '../../icons/SvgGitHub';
import { cn } from '../../shared/lib/cn';
import { Modal } from '../../shared/ui/Modal';
import { QRCode } from '../../shared/ui/QRCode';
import { MobileSectionMenu } from './MobileSectionMenu';

const GITHUB_URL = 'https://github.com/frozik/portfolio';
const QR_SIZE_PX = 216;
const ICON_SIZE_PX = 16;
const PROJECTS_ROUTE_WITH_HASH = '/#projects';

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

  const handleQROpen = useFunction(() => setQrOpen(true));
  const handleQRClose = useFunction(() => setQrOpen(false));
  const handleMenuOpen = useFunction(() => setMenuOpen(true));
  const handleMenuClose = useFunction(() => setMenuOpen(false));
  const handleSectionNavigate = useFunction((sectionId: string) => scrollToSection(sectionId));

  const handleBrandClick = useFunction(() => {
    if (variant === 'inner') {
      navigate(PROJECTS_ROUTE_WITH_HASH);
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    history.replaceState(null, '', window.location.pathname + window.location.search);
  });

  const isLanding = variant === 'landing';

  return (
    <div className="print:hidden">
      <nav className="sticky top-0 z-50 border-b border-landing-border bg-landing-bg/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[var(--container-narrow)] items-center justify-between gap-3 px-6 py-2 md:gap-6 md:px-12">
          <button
            type="button"
            onClick={handleBrandClick}
            className="shrink-0 cursor-pointer bg-transparent p-0 font-mono text-[13px] text-landing-fg"
          >
            {welcomeT.nav.brandRoot}
            <span className="text-landing-fg-faint">{welcomeT.nav.brandPath}</span>
          </button>

          {isLanding && (
            <div className="hidden font-mono text-xs text-landing-fg-dim min-[950px]:flex min-[950px]:gap-8">
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

            {isLanding && (
              <button
                type="button"
                onClick={handleMenuOpen}
                className={cn(iconButtonClassName, 'min-[950px]:hidden')}
                aria-label={welcomeT.nav.openMenu}
              >
                <Menu size={ICON_SIZE_PX} />
              </button>
            )}
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

      {isLanding && (
        <MobileSectionMenu
          open={menuOpen}
          onClose={handleMenuClose}
          sections={welcomeT.nav.sections}
          title={welcomeT.nav.sectionsTitle}
          onNavigate={handleSectionNavigate}
        />
      )}
    </div>
  );
};

export const TopNav = memo(TopNavComponent);
